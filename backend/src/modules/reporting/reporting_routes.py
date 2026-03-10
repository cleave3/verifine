import uuid
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, and_
from sqlalchemy.orm import selectinload
from src.core.tenant import get_current_org

from src.core.database import get_session
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.reporting.reporting_schema import (
    TrialBalanceReport,
    TrialBalanceLine,
    PLReport,
    PLAccountLine,
    BalanceSheetReport,
    BalanceSheetAccountLine,
    TaxLiabilityReport,
    TaxLiabilityLine,
)
from src.models.fiscal_period import FiscalPeriod
from src.models.account import Account, AccountType
from src.models.journal_entry import LedgerLine, JournalEntry

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/trial-balance/{period_id}")
async def get_trial_balance(
    period_id: int,
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
):
    stmt = select(FiscalPeriod).where(
        and_(FiscalPeriod.id == period_id, FiscalPeriod.org_id == org_id)
    )
    period = (await session.exec(stmt)).first()
    if not period:
        raise BadRequest("Fiscal period not found")

    # Aggregate ledger lines for this period grouped by account
    stmt = (
        select(
            Account,
            func.sum(LedgerLine.base_debit).label("total_debit"),
            func.sum(LedgerLine.base_credit).label("total_credit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
        .where(Account.org_id == org_id)
        .group_by(Account.id)
        .order_by(Account.code)
    )

    results = await session.exec(stmt)

    lines = []
    total_debit = 0.0
    total_credit = 0.0

    for account, summed_debits, summed_credits in results:
        t_debit = float(summed_debits or 0.0)
        t_credit = float(summed_credits or 0.0)

        # Calculate NET balance based on normal balance rules
        normal_balance = (
            "DEBIT"
            if account.type in (AccountType.ASSET, AccountType.EXPENSE)
            else "CREDIT"
        )
        if normal_balance == "DEBIT":
            net_balance = t_debit - t_credit
            line_debit = net_balance if net_balance > 0 else 0.0
            line_credit = abs(net_balance) if net_balance < 0 else 0.0
        else:  # CREDIT
            net_balance = t_credit - t_debit
            line_credit = net_balance if net_balance > 0 else 0.0
            line_debit = abs(net_balance) if net_balance < 0 else 0.0

        if line_debit > 0 or line_credit > 0:
            lines.append(
                TrialBalanceLine(
                    account_code=account.code,
                    account_name=account.name,
                    normal_balance=normal_balance,
                    debit=line_debit,
                    credit=line_credit,
                )
            )
            total_debit += line_debit
            total_credit += line_credit

    # Round correctly to prevent floating point matching issues
    total_debit = round(total_debit, 2)
    total_credit = round(total_credit, 2)

    report = TrialBalanceReport(
        period_id=period_id,
        lines=lines,
        total_debit=total_debit,
        total_credit=total_credit,
        is_balanced=(total_debit == total_credit),
    )

    return response(200, "Trial Balance generated successfully", report.model_dump())


@router.get("/profit-and-loss/{period_id}")
async def get_profit_and_loss(
    period_id: int,
    tracking_option_id: int | None = None,
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
):
    stmt_fp = select(FiscalPeriod).where(
        and_(FiscalPeriod.id == period_id, FiscalPeriod.org_id == org_id)
    )
    period = (await session.exec(stmt_fp)).first()
    if not period:
        raise BadRequest("Fiscal period not found")

    # Revenue Accounts
    stmt_revenue = (
        select(
            Account,
            func.sum(LedgerLine.base_credit).label("total_credit"),
            func.sum(LedgerLine.base_debit).label("total_debit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
        .where(Account.org_id == org_id)
        .where(Account.type == AccountType.REVENUE)
    )

    if tracking_option_id:
        stmt_revenue = stmt_revenue.where(
            LedgerLine.tracking_option_id == tracking_option_id
        )

    stmt_revenue = stmt_revenue.group_by(Account.id).order_by(Account.code)

    # Expense Accounts
    stmt_expense = (
        select(
            Account,
            func.sum(LedgerLine.base_debit).label("total_debit"),
            func.sum(LedgerLine.base_credit).label("total_credit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
        .where(Account.org_id == org_id)
        .where(Account.type == AccountType.EXPENSE)
    )

    if tracking_option_id:
        stmt_expense = stmt_expense.where(
            LedgerLine.tracking_option_id == tracking_option_id
        )

    stmt_expense = stmt_expense.group_by(Account.id).order_by(Account.code)

    rev_results = await session.exec(stmt_revenue)
    exp_results = await session.exec(stmt_expense)

    revenue_lines = []
    total_revenue = 0.0

    for act, credits, debits in rev_results:
        # Revenue normal balance is CREDIT
        net = float(credits or 0) - float(debits or 0)
        revenue_lines.append(
            PLAccountLine(account_code=act.code, account_name=act.name, balance=net)
        )
        total_revenue += net

    expense_lines = []
    total_expenses = 0.0

    for act, debits, credits in exp_results:
        # Expense normal balance is DEBIT
        net = float(debits or 0) - float(credits or 0)
        expense_lines.append(
            PLAccountLine(account_code=act.code, account_name=act.name, balance=net)
        )
        total_expenses += net

    total_revenue = round(total_revenue, 2)
    total_expenses = round(total_expenses, 2)
    net_income = round(total_revenue - total_expenses, 2)

    report = PLReport(
        period_id=period_id,
        revenue_lines=revenue_lines,
        total_revenue=total_revenue,
        expense_lines=expense_lines,
        total_expenses=total_expenses,
        net_income=net_income,
    )

    return response(200, "Profit and Loss generated successfully", report.model_dump())


@router.get("/balance-sheet/{period_id}")
async def get_balance_sheet(
    period_id: int,
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
):
    stmt_fp = select(FiscalPeriod).where(
        and_(FiscalPeriod.id == period_id, FiscalPeriod.org_id == org_id)
    )
    period = (await session.exec(stmt_fp)).first()
    if not period:
        raise BadRequest("Fiscal period not found")

    # For Balance Sheet, we need cumulative balances up to the end of the period
    end_date = period.end_date

    # Base query for all accounts up to the period end date
    stmt_base = (
        select(
            Account.id,
            Account.code,
            Account.name,
            Account.type,
            func.sum(LedgerLine.base_debit).label("total_debit"),
            func.sum(LedgerLine.base_credit).label("total_credit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.entry_date <= end_date)
        .where(Account.org_id == org_id)
        .group_by(Account.id)
        .order_by(Account.code)
    )

    results = await session.exec(stmt_base)

    assets_lines = []
    total_assets = 0.0

    liabilities_lines = []
    total_liabilities = 0.0

    equity_lines = []
    total_equity = 0.0

    # For implicit retained earnings
    cumulative_revenue = 0.0
    cumulative_expense = 0.0

    for act_id, code, name, act_type, debits, credits in results:
        d = float(debits or 0)
        c = float(credits or 0)

        if act_type == AccountType.ASSET:
            net = d - c
            if net != 0:
                assets_lines.append(
                    BalanceSheetAccountLine(
                        account_code=code, account_name=name, balance=net
                    )
                )
                total_assets += net
        elif act_type == AccountType.LIABILITY:
            net = c - d
            if net != 0:
                liabilities_lines.append(
                    BalanceSheetAccountLine(
                        account_code=code, account_name=name, balance=net
                    )
                )
                total_liabilities += net
        elif act_type == AccountType.EQUITY:
            net = c - d
            if net != 0:
                equity_lines.append(
                    BalanceSheetAccountLine(
                        account_code=code, account_name=name, balance=net
                    )
                )
                total_equity += net
        elif act_type == AccountType.REVENUE:
            cumulative_revenue += c - d
        elif act_type == AccountType.EXPENSE:
            cumulative_expense += d - c

    # Calculate Retained Earnings
    retained_earnings = cumulative_revenue - cumulative_expense
    if retained_earnings != 0:
        equity_lines.append(
            BalanceSheetAccountLine(
                account_code="3999",  # synthetic code
                account_name="Retained Earnings",
                balance=round(retained_earnings, 2),
            )
        )
        total_equity += retained_earnings

    total_assets = round(total_assets, 2)
    total_liabilities = round(total_liabilities, 2)
    total_equity = round(total_equity, 2)
    total_liabilities_and_equity = round(total_liabilities + total_equity, 2)

    report = BalanceSheetReport(
        period_id=period_id,
        assets_lines=assets_lines,
        total_assets=total_assets,
        liabilities_lines=liabilities_lines,
        total_liabilities=total_liabilities,
        equity_lines=equity_lines,
        total_equity=total_equity,
        total_liabilities_and_equity=total_liabilities_and_equity,
        is_balanced=(total_assets == total_liabilities_and_equity),
    )

    return response(200, "Balance Sheet generated successfully", report.model_dump())


from src.models.tax import TaxRate


@router.get("/tax-liability/{period_id}")
async def get_tax_liability(
    period_id: int,
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
):
    stmt_fp = select(FiscalPeriod).where(
        and_(FiscalPeriod.id == period_id, FiscalPeriod.org_id == org_id)
    )
    period = (await session.exec(stmt_fp)).first()
    if not period:
        raise BadRequest("Fiscal period not found")

    # Fetch all tax rates for the org
    stmt_taxes = select(TaxRate).where(TaxRate.org_id == org_id)
    tax_rates = (await session.exec(stmt_taxes)).all()

    # Aggregate debit and credit balances per account ID linked to TaxRates in this period
    # To optimize, we just query the balances of the required accounts for the period
    tax_account_ids = list(set([t.account_id for t in tax_rates]))

    if not tax_account_ids:
        report = TaxLiabilityReport(
            period_id=period_id,
            lines=[],
            total_collected=0.0,
            total_paid=0.0,
            net_liability_total=0.0,
        )
        return response(
            200, "Tax Liability generated successfully", report.model_dump()
        )

    stmt_bals = (
        select(
            Account.id,
            func.sum(LedgerLine.base_credit).label("total_credit"),
            func.sum(LedgerLine.base_debit).label("total_debit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
        .where(Account.id.in_(tax_account_ids))
        .group_by(Account.id)
    )

    results = await session.exec(stmt_bals)

    account_balances = {}
    for act_id, credits, debits in results:
        account_balances[act_id] = {
            "credit": float(credits or 0),
            "debit": float(debits or 0),
        }

    lines = []
    total_collected_all = 0.0
    total_paid_all = 0.0
    net_liability_all = 0.0

    # Note: If two TaxRates share an account_id, their values will be identical in this design.
    for tr in tax_rates:
        bals = account_balances.get(tr.account_id, {"credit": 0.0, "debit": 0.0})
        collected = bals["credit"]  # Output VAT is usually credited
        paid = bals["debit"]  # Input VAT is usually debited
        net = collected - paid

        lines.append(
            TaxLiabilityLine(
                tax_rate_id=tr.id,
                tax_rate_name=tr.name,
                tax_rate_percentage=float(tr.rate),
                total_collected=collected,
                total_paid=paid,
                net_liability=net,
            )
        )
        total_collected_all += collected
        total_paid_all += paid
        net_liability_all += net

    # Deduplicate totals if accounts were shared, because we're just summing up everything by account
    real_total_collected = sum(b.get("credit", 0) for b in account_balances.values())
    real_total_paid = sum(b.get("debit", 0) for b in account_balances.values())
    real_net = real_total_collected - real_total_paid

    report = TaxLiabilityReport(
        period_id=period_id,
        lines=lines,
        total_collected=round(real_total_collected, 2),
        total_paid=round(real_total_paid, 2),
        net_liability_total=round(real_net, 2),
    )

    return response(200, "Tax Liability generated successfully", report.model_dump())
