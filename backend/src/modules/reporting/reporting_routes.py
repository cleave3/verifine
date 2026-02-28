from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func
from sqlalchemy.orm import selectinload

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
)
from src.models.fiscal_period import FiscalPeriod
from src.models.account import Account, AccountType
from src.models.journal_entry import LedgerLine, JournalEntry

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/trial-balance/{period_id}")
async def get_trial_balance(
    period_id: int, session: AsyncSession = Depends(get_session)
):
    period = await session.get(FiscalPeriod, period_id)
    if not period:
        raise BadRequest("Fiscal period not found")

    # Aggregate ledger lines for this period grouped by account
    stmt = (
        select(
            Account,
            func.sum(LedgerLine.debit).label("total_debit"),
            func.sum(LedgerLine.credit).label("total_credit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
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
    period_id: int, session: AsyncSession = Depends(get_session)
):
    period = await session.get(FiscalPeriod, period_id)
    if not period:
        raise BadRequest("Fiscal period not found")

    # Revenue Accounts
    stmt_revenue = (
        select(
            Account,
            func.sum(LedgerLine.credit).label("total_credit"),
            func.sum(LedgerLine.debit).label("total_debit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
        .where(Account.type == AccountType.REVENUE)
        .group_by(Account.id)
        .order_by(Account.code)
    )

    # Expense Accounts
    stmt_expense = (
        select(
            Account,
            func.sum(LedgerLine.debit).label("total_debit"),
            func.sum(LedgerLine.credit).label("total_credit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.period_id == period_id)
        .where(Account.type == AccountType.EXPENSE)
        .group_by(Account.id)
        .order_by(Account.code)
    )

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
    period_id: int, session: AsyncSession = Depends(get_session)
):
    period = await session.get(FiscalPeriod, period_id)
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
            func.sum(LedgerLine.debit).label("total_debit"),
            func.sum(LedgerLine.credit).label("total_credit"),
        )
        .join(LedgerLine, LedgerLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
        .where(JournalEntry.entry_date <= end_date)
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
