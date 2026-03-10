import uuid
from datetime import datetime, timezone
from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, and_
from src.core.database import get_session
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.modules.fiscal_period.fiscal_period_schema import FiscalPeriodCreate
from src.core.errors import BadRequest


class FiscalPeriodService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_periods(self, org_id: uuid.UUID) -> Sequence[FiscalPeriod]:
        statement = (
            select(FiscalPeriod)
            .where(FiscalPeriod.org_id == org_id)
            .order_by(FiscalPeriod.start_date)
        )
        results = await self.session.exec(statement)
        return results.all()

    async def get_period_by_name(
        self, org_id: uuid.UUID, name: str
    ) -> Optional[FiscalPeriod]:
        statement = select(FiscalPeriod).where(
            and_(FiscalPeriod.name == name, FiscalPeriod.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def get_period_by_id(
        self, org_id: uuid.UUID, period_id: int
    ) -> Optional[FiscalPeriod]:
        statement = select(FiscalPeriod).where(
            and_(FiscalPeriod.id == period_id, FiscalPeriod.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_period(
        self, org_id: uuid.UUID, period_in: FiscalPeriodCreate
    ) -> FiscalPeriod:
        # 1. Basic range check
        if period_in.start_date >= period_in.end_date:
            raise BadRequest("Start date must be before end date.")

        # 2. Check for overlapping periods for this organization
        # Overlap condition: (StartA <= EndB) and (EndA >= StartB)
        overlap_stmt = select(FiscalPeriod).where(
            and_(
                FiscalPeriod.org_id == org_id,
                FiscalPeriod.start_date <= period_in.end_date,
                FiscalPeriod.end_date >= period_in.start_date,
            )
        )
        existing_overlap = (await self.session.exec(overlap_stmt)).first()

        if existing_overlap:
            raise BadRequest(
                f"Date range overlaps with existing period: {existing_overlap.name} "
                f"({existing_overlap.start_date} to {existing_overlap.end_date})"
            )

        db_period = FiscalPeriod(
            name=period_in.name,
            start_date=period_in.start_date,
            end_date=period_in.end_date,
            status=PeriodStatus.OPEN,
            org_id=org_id,
        )
        self.session.add(db_period)
        await self.session.commit()
        await self.session.refresh(db_period)
        return db_period

    async def lock_period(
        self, org_id: uuid.UUID, period_id: int
    ) -> Optional[FiscalPeriod]:
        db_period = await self.get_period_by_id(org_id, period_id)
        if not db_period:
            return None

        db_period.status = PeriodStatus.LOCKED
        self.session.add(db_period)
        await self.session.commit()
        await self.session.refresh(db_period)
        return db_period

    async def close_period(
        self, org_id: uuid.UUID, period_id: int, retained_earnings_account_id: int
    ) -> Optional[FiscalPeriod]:
        from src.models.account import Account, AccountType
        from src.models.journal_entry import JournalEntry, LedgerLine, JournalStatus
        from sqlmodel import func

        db_period = await self.get_period_by_id(org_id, period_id)
        if not db_period:
            return None

        if db_period.status == PeriodStatus.CLOSED:
            return db_period

        # 1. Verify retained earnings account exists and is Equity
        re_acct = await self.session.get(Account, retained_earnings_account_id)
        if (
            not re_acct
            or re_acct.org_id != org_id
            or re_acct.type != AccountType.EQUITY
        ):
            raise BadRequest(
                "Invalid Retained Earnings account. It must be an Equity account belonging to your organization."
            )

        # 2. Find all balances for REVENUE and EXPENSE accounts in this period.
        stmt = (
            select(
                LedgerLine.account_id,
                func.sum(LedgerLine.base_debit).label("total_debit"),
                func.sum(LedgerLine.base_credit).label("total_credit"),
                Account.type,
            )
            .join(JournalEntry)
            .join(Account)
            .where(
                JournalEntry.org_id == org_id,
                JournalEntry.period_id == period_id,
                JournalEntry.status == JournalStatus.POSTED,
                Account.type.in_([AccountType.REVENUE, AccountType.EXPENSE]),
            )
            .group_by(LedgerLine.account_id, Account.type)
        )
        balances = (await self.session.exec(stmt)).all()

        if balances:
            # We need to create a closing Journal Entry
            closing_je = JournalEntry(
                org_id=org_id,
                period_id=period_id,
                entry_date=db_period.end_date,
                description=f"Year-End Closing for {db_period.name}",
                status=JournalStatus.POSTED,
                created_by="SYSTEM",
            )
            self.session.add(closing_je)
            await self.session.flush()

            retained_earnings_amount = 0.0

            for acc_id, t_debit, t_credit, a_type in balances:
                balance = float(t_debit or 0.0) - float(t_credit or 0.0)
                if abs(balance) < 0.01:
                    continue

                line_debit = 0.0
                line_credit = 0.0

                if balance > 0:
                    # Debit balance, need to credit to zero out
                    line_credit = balance
                    retained_earnings_amount -= (
                        balance  # We credit the account, so we debit RE to balance
                    )
                else:
                    # Credit balance, need to debit to zero out
                    line_debit = abs(balance)
                    retained_earnings_amount += abs(
                        balance
                    )  # We debit the account, so we credit RE to balance

                self.session.add(
                    LedgerLine(
                        journal_entry_id=closing_je.id,
                        account_id=acc_id,
                        description="Closing Entry to zero account",
                        currency_code="NGN",  # Or whatever base currency is
                        exchange_rate=1.0,
                        transaction_debit=line_debit,
                        transaction_credit=line_credit,
                        base_debit=line_debit,
                        base_credit=line_credit,
                    )
                )

            # Add the RE offset line if not zero
            if abs(retained_earnings_amount) >= 0.01:
                re_debit = 0.0
                re_credit = 0.0
                if (
                    retained_earnings_amount > 0
                ):  # Note: positive means we must debit RE (Net Loss)
                    re_debit = retained_earnings_amount
                else:  # Negative means we must credit RE (Net Income)
                    re_credit = abs(retained_earnings_amount)

                self.session.add(
                    LedgerLine(
                        journal_entry_id=closing_je.id,
                        account_id=retained_earnings_account_id,
                        description="Net Income/Loss transferred to Retained Earnings",
                        currency_code="NGN",
                        exchange_rate=1.0,
                        transaction_debit=re_debit,
                        transaction_credit=re_credit,
                        base_debit=re_debit,
                        base_credit=re_credit,
                    )
                )

        db_period.status = PeriodStatus.CLOSED
        db_period.closed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.session.add(db_period)
        await self.session.commit()
        await self.session.refresh(db_period)
        return db_period


def get_fiscal_period_service(
    session: AsyncSession = Depends(get_session),
) -> FiscalPeriodService:
    return FiscalPeriodService(session=session)
