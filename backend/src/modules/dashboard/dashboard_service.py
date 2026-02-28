from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, desc
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
)


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_dashboard_summary(self) -> dict:
        # --- 1. Top Level Stats ---
        ar_stmt = select(func.sum(Invoice.total_amount)).where(
            Invoice.status.in_(["SENT", "POSTED"])
        )
        ap_stmt = select(func.sum(Bill.total_amount)).where(
            Bill.status.in_(["APPROVED", "POSTED"])
        )

        total_open_ar = (await self.session.exec(ar_stmt)).first() or 0.0
        total_open_ap = (await self.session.exec(ap_stmt)).first() or 0.0

        # Current Period Stats
        current_period_stmt = (
            select(FiscalPeriod)
            .where(FiscalPeriod.status == PeriodStatus.OPEN)
            .order_by(FiscalPeriod.start_date.desc())
            .limit(1)
        )
        current_period = (await self.session.exec(current_period_stmt)).first()

        curr_rev = 0.0
        curr_exp = 0.0

        if current_period:
            # Revenue (CREDITS - DEBITS)
            rev_stmt = (
                select(
                    func.sum(LedgerLine.credit).label("total_credit"),
                    func.sum(LedgerLine.debit).label("total_debit"),
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
                    func.sum(LedgerLine.debit).label("total_debit"),
                    func.sum(LedgerLine.credit).label("total_credit"),
                )
                .join(JournalEntry, JournalEntry.id == LedgerLine.journal_entry_id)
                .join(Account, Account.id == LedgerLine.account_id)
                .where(JournalEntry.period_id == current_period.id)
                .where(Account.type == AccountType.EXPENSE)
            )
            exp_res = await self.session.exec(exp_stmt)
            d, c = exp_res.first() or (0, 0)
            curr_exp = float(d or 0) - float(c or 0)

        # --- 2. Recent Transactions ---
        # Fixed journal_date to entry_date, created_at is not on JournalEntry either. Wait, looking at JournalEntry model, it only has id, transaction_id, description, entry_date, status, period_id, created_by_id. Let's order by entry_date and id instead.
        recent_stmt = (
            select(JournalEntry)
            .order_by(desc(JournalEntry.entry_date), desc(JournalEntry.id))
            .limit(8)
        )
        recent_jes = (await self.session.exec(recent_stmt)).all()
        recent_txs = []

        for je in recent_jes:
            line_stmt = select(func.sum(LedgerLine.debit)).where(
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
            select(FiscalPeriod).order_by(desc(FiscalPeriod.start_date)).limit(6)
        )
        last_6_periods = (await self.session.exec(periods_stmt)).all()
        last_6_periods.reverse()

        chart_data = []

        for period in last_6_periods:
            rev_stmt = (
                select(
                    func.sum(LedgerLine.credit).label("total_credit"),
                    func.sum(LedgerLine.debit).label("total_debit"),
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
                    func.sum(LedgerLine.debit).label("total_debit"),
                    func.sum(LedgerLine.credit).label("total_credit"),
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
        )

        data = DashboardResponse(
            stats=stats, chart_data=chart_data, recent_transactions=recent_txs
        )

        return data.model_dump()
