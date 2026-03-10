import uuid
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, desc, and_
from datetime import datetime, timezone

from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.models.invoice import Invoice
from src.models.bill import Bill
from src.models.account import Account, AccountType
from src.models.journal_entry import JournalEntry, LedgerLine
from src.modules.dashboard.dashboard_schema import (
    DashboardResponse,
    DashboardStats,
    ChartDataPoint,
    RecentTransaction,
    AgingPoint,
    DashboardRate,
)


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_dashboard_summary(self, org_id: uuid.UUID) -> dict:
        today = datetime.now(timezone.utc).date()

        # --- 1. Top Level Stats & Liquidity ---
        ar_stmt = select(func.sum(Invoice.base_total_amount)).where(
            and_(Invoice.status.in_(["SENT", "POSTED"]), Invoice.org_id == org_id)
        )
        ap_stmt = select(func.sum(Bill.base_total_amount)).where(
            and_(Bill.status.in_(["APPROVED", "POSTED"]), Bill.org_id == org_id)
        )

        total_open_ar = (await self.session.exec(ar_stmt)).first() or 0.0
        total_open_ap = (await self.session.exec(ap_stmt)).first() or 0.0

        # Cash Position (Sum of all ASSET accounts that are cash/bank)
        # We look for accounts named 'Cash' or 'Bank' or code starting with 10 typically.
        # For simplicity, we use the name check from the implementation plan.
        cash_accounts_stmt = select(Account.id).where(
            and_(
                Account.org_id == org_id,
                Account.type == AccountType.ASSET,
                func.lower(Account.name).contains("cash")
                | func.lower(Account.name).contains("bank"),
            )
        )
        cash_account_ids = (await self.session.exec(cash_accounts_stmt)).all()

        cash_position = 0.0
        if cash_account_ids:
            cash_stmt = select(
                func.sum(LedgerLine.base_debit).label("debit"),
                func.sum(LedgerLine.base_credit).label("credit"),
            ).where(LedgerLine.account_id.in_(cash_account_ids))
            cash_res = (await self.session.exec(cash_stmt)).first()
            if cash_res:
                d, c = cash_res
                cash_position = float(d or 0) - float(c or 0)

        # AR/AP Aging Logic
        # Overdue AR
        ar_overdue_stmt = select(func.sum(Invoice.base_total_amount)).where(
            and_(
                Invoice.org_id == org_id,
                Invoice.status.in_(["SENT", "POSTED"]),
                Invoice.due_date < today,
            )
        )
        ar_overdue = (await self.session.exec(ar_overdue_stmt)).first() or 0.0

        # Upcoming AR
        ar_upcoming_stmt = select(func.sum(Invoice.base_total_amount)).where(
            and_(
                Invoice.org_id == org_id,
                Invoice.status.in_(["SENT", "POSTED"]),
                Invoice.due_date >= today,
            )
        )
        ar_upcoming = (await self.session.exec(ar_upcoming_stmt)).first() or 0.0

        # Overdue AP
        ap_overdue_stmt = select(func.sum(Bill.base_total_amount)).where(
            and_(
                Bill.org_id == org_id,
                Bill.status.in_(["APPROVED", "POSTED"]),
                Bill.due_date < today,
            )
        )
        ap_overdue = (await self.session.exec(ap_overdue_stmt)).first() or 0.0

        # Upcoming AP
        ap_upcoming_stmt = select(func.sum(Bill.base_total_amount)).where(
            and_(
                Bill.org_id == org_id,
                Bill.status.in_(["APPROVED", "POSTED"]),
                Bill.due_date >= today,
            )
        )
        ap_upcoming = (await self.session.exec(ap_upcoming_stmt)).first() or 0.0

        aging_data = [
            AgingPoint(
                label="Overdue", ar=round(ar_overdue, 2), ap=round(ap_overdue, 2)
            ),
            AgingPoint(
                label="Upcoming", ar=round(ar_upcoming, 2), ap=round(ap_upcoming, 2)
            ),
        ]

        # Current Period Stats
        current_period_stmt = (
            select(FiscalPeriod)
            .where(
                and_(
                    FiscalPeriod.status == PeriodStatus.OPEN,
                    FiscalPeriod.org_id == org_id,
                )
            )
            .order_by(FiscalPeriod.start_date.desc())
            .limit(1)
        )
        current_period = (await self.session.exec(current_period_stmt)).first()

        curr_rev = 0.0
        curr_exp = 0.0
        period_status = "N/A"

        if current_period:
            period_status = current_period.status
            # Revenue (CREDITS - DEBITS)
            rev_stmt = (
                select(
                    func.sum(LedgerLine.base_credit).label("total_credit"),
                    func.sum(LedgerLine.base_debit).label("total_debit"),
                )
                .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
                .join(Account, Account.id == LedgerLine.account_id)
                .where(JournalEntry.period_id == current_period.id)
                .where(Account.type == AccountType.REVENUE)
            )
            rev_res = await self.session.exec(rev_stmt)
            c, d = rev_res.first() or (0, 0)
            curr_rev = float(c or 0) - float(d or 0)

            # Expenses (DEBITS - CREDITS)
            exp_stmt = (
                select(
                    func.sum(LedgerLine.base_debit).label("total_debit"),
                    func.sum(LedgerLine.base_credit).label("total_credit"),
                )
                .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
                .join(Account, Account.id == LedgerLine.account_id)
                .where(JournalEntry.period_id == current_period.id)
                .where(Account.type == AccountType.EXPENSE)
            )
            exp_res = await self.session.exec(exp_stmt)
            d, c = exp_res.first() or (0, 0)
            curr_exp = float(d or 0) - float(c or 0)

        # Exchange Rates
        from src.models.settings import ExchangeRate

        rates_stmt = select(ExchangeRate).where(ExchangeRate.org_id == org_id)
        rates_res = (await self.session.exec(rates_stmt)).all()
        exchange_rates = [
            DashboardRate(currency_code=r.currency_code, rate=r.rate) for r in rates_res
        ]

        # --- 2. Recent Transactions ---
        recent_stmt = (
            select(JournalEntry)
            .where(JournalEntry.org_id == org_id)
            .order_by(desc(JournalEntry.entry_date), desc(JournalEntry.id))
            .limit(6)
        )
        recent_jes = (await self.session.exec(recent_stmt)).all()
        recent_txs = []

        for je in recent_jes:
            line_stmt = select(func.sum(LedgerLine.base_debit)).where(
                LedgerLine.journal_entry_id == je.id
            )
            amount = (await self.session.exec(line_stmt)).first() or 0.0
            recent_txs.append(
                RecentTransaction(
                    id=je.id,
                    date=je.entry_date.isoformat(),
                    description=je.description,
                    amount=amount,
                    type="JE",
                )
            )

        # --- 3. Chart Data (Last 6 Periods) ---
        periods_stmt = (
            select(FiscalPeriod)
            .where(FiscalPeriod.org_id == org_id)
            .order_by(desc(FiscalPeriod.start_date))
            .limit(6)
        )
        last_6_periods = (await self.session.exec(periods_stmt)).all()
        last_6_periods.reverse()

        chart_data = []

        for period in last_6_periods:
            rev_stmt = (
                select(
                    func.sum(LedgerLine.base_credit).label("total_credit"),
                    func.sum(LedgerLine.base_debit).label("total_debit"),
                )
                .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
                .join(Account, Account.id == LedgerLine.account_id)
                .where(JournalEntry.period_id == period.id)
                .where(Account.type == AccountType.REVENUE)
            )
            rev_res = await self.session.exec(rev_stmt)
            c, d = rev_res.first() or (0, 0)
            p_rev = float(c or 0) - float(d or 0)

            exp_stmt = (
                select(
                    func.sum(LedgerLine.base_debit).label("total_debit"),
                    func.sum(LedgerLine.base_credit).label("total_credit"),
                )
                .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
                .join(Account, Account.id == LedgerLine.account_id)
                .where(JournalEntry.period_id == period.id)
                .where(Account.type == AccountType.EXPENSE)
            )
            exp_res = await self.session.exec(exp_stmt)
            d, c = exp_res.first() or (0, 0)
            p_exp = float(d or 0) - float(c or 0)

            chart_data.append(
                ChartDataPoint(
                    name=period.name,
                    revenue=round(p_rev, 2),
                    expenses=round(p_exp, 2),
                    net_income=round(p_rev - p_exp, 2),
                )
            )

        stats = DashboardStats(
            total_open_ar=round(total_open_ar, 2),
            total_open_ap=round(total_open_ap, 2),
            current_period_revenue=round(curr_rev, 2),
            current_period_expenses=round(curr_exp, 2),
            current_period_net_income=round(curr_rev - curr_exp, 2),
            cash_position=round(cash_position, 2),
            period_status=period_status,
        )

        data = DashboardResponse(
            stats=stats,
            chart_data=chart_data,
            recent_transactions=recent_txs,
            aging_data=aging_data,
            exchange_rates=exchange_rates,
        )

        return data.model_dump()
