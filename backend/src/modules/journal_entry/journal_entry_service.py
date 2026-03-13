import uuid
from datetime import datetime, date
from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from src.core.database import get_session
from src.models.journal_entry import JournalEntry, LedgerLine, JournalEntryStatus
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.modules.journal_entry.journal_entry_schema import JournalEntryCreate
from src.core.errors import BadRequest
from src.utils.common import get_pagination_meta


class JournalEntryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_journal_entries(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 10,
        status: Optional[JournalEntryStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ):
        statement = (
            select(JournalEntry)
            .where(JournalEntry.org_id == org_id)
            .options(selectinload(JournalEntry.lines))
            .order_by(JournalEntry.id.desc())
        )

        total_statement = select(func.count(JournalEntry.id)).where(
            JournalEntry.org_id == org_id
        )

        if status:
            statement = statement.where(JournalEntry.status == status)
            total_statement = total_statement.where(JournalEntry.status == status)

        if start_date:
            statement = statement.where(JournalEntry.entry_date >= start_date)
            total_statement = total_statement.where(
                JournalEntry.entry_date >= start_date
            )

        if end_date:
            statement = statement.where(JournalEntry.entry_date <= end_date)
            total_statement = total_statement.where(JournalEntry.entry_date <= end_date)

        statement = statement.offset((page - 1) * page_size).limit(page_size)

        results = await self.session.exec(statement)
        total_result = await self.session.exec(total_statement)
        total_records = total_result.first()

        return {
            "results": results.all(),
            "meta": get_pagination_meta(page, page_size, total_records),
        }

    async def get_journal_entry_by_id(
        self, org_id: uuid.UUID, je_id: int
    ) -> Optional[JournalEntry]:
        statement = (
            select(JournalEntry)
            .where(and_(JournalEntry.id == je_id, JournalEntry.org_id == org_id))
            .options(selectinload(JournalEntry.lines))
        )
        result = await self.session.exec(statement)
        return result.first()

    async def generate_transaction_id(
        self, org_id: uuid.UUID, entry_date: datetime.date
    ) -> str:
        year_month = entry_date.strftime("%Y-%m")
        prefix = f"JE-{year_month}-"

        statement = select(JournalEntry).where(
            and_(
                JournalEntry.transaction_id.startswith(prefix),
                JournalEntry.org_id == org_id,
            )
        )
        results = await self.session.exec(statement)
        existing_entries = results.all()
        next_num = len(existing_entries) + 1

        return f"{prefix}{next_num:04d}"

    async def create_journal_entry(
        self, org_id: uuid.UUID, je_in: JournalEntryCreate, user_id: int
    ) -> JournalEntry:
        # 1. Validate the fiscal period
        stmt = select(FiscalPeriod).where(
            and_(FiscalPeriod.id == je_in.period_id, FiscalPeriod.org_id == org_id)
        )
        period = (await self.session.exec(stmt)).first()
        if not period:
            raise BadRequest("Invalid fiscal period specified.")

        if period.status != PeriodStatus.OPEN:
            raise BadRequest(
                f"Cannot post to a {period.status} period. Period must be OPEN."
            )

        if je_in.entry_date < period.start_date or je_in.entry_date > period.end_date:
            raise BadRequest(
                f"Entry date {je_in.entry_date} falls outside the selected fiscal period boundaries."
            )

        # 2. Generate Transaction ID
        transaction_id = await self.generate_transaction_id(org_id, je_in.entry_date)

        # 3. Create the Journal Entry
        db_je = JournalEntry(
            transaction_id=transaction_id,
            description=je_in.description,
            entry_date=je_in.entry_date,
            period_id=je_in.period_id,
            created_by_id=user_id,
            status=JournalEntryStatus.DRAFT,
            org_id=org_id,
        )

        self.session.add(db_je)
        await self.session.flush()

        # 4. Create Ledger Lines
        for line_in in je_in.lines:
            db_line = LedgerLine(
                journal_entry_id=db_je.id,
                account_id=line_in.account_id,
                currency_code=line_in.currency_code,
                exchange_rate=line_in.exchange_rate,
                transaction_debit=line_in.transaction_debit,
                transaction_credit=line_in.transaction_credit,
                base_debit=line_in.base_debit,
                base_credit=line_in.base_credit,
                description=line_in.description,
                org_id=org_id,
            )
            self.session.add(db_line)

        # 5. Commit atomically
        await self.session.commit()

        return await self.get_journal_entry_by_id(org_id, db_je.id)

    async def update_journal_entry(
        self, org_id: uuid.UUID, je_id: int, je_in: JournalEntryCreate, user_id: int
    ) -> JournalEntry:
        # 1. Get the existing journal entry
        je = await self.get_journal_entry_by_id(org_id, je_id)
        if not je:
            raise BadRequest("Journal entry not found.")

        # 2. Ensure it's still a draft
        if je.status != JournalEntryStatus.DRAFT:
            raise BadRequest(f"Cannot edit a journal entry with status: {je.status}")

        # 3. Validate the new fiscal period
        stmt = select(FiscalPeriod).where(
            and_(FiscalPeriod.id == je_in.period_id, FiscalPeriod.org_id == org_id)
        )
        period = (await self.session.exec(stmt)).first()
        if not period:
            raise BadRequest("Invalid fiscal period specified.")

        if period.status != PeriodStatus.OPEN:
            raise BadRequest(f"Cannot update to a {period.status} period.")

        if je_in.entry_date < period.start_date or je_in.entry_date > period.end_date:
            raise BadRequest("Entry date falls outside fiscal period boundaries.")

        # 4. Update Header
        je.description = je_in.description
        je.entry_date = je_in.entry_date
        je.period_id = je_in.period_id
        # We don't change transaction_id as it was already generated based on original date
        # unless the month changed significantly, but usually we keep it or regenerate.
        # For simplicity, if entry_date changed its month, we might want to regenerate?
        # Let's check if month/year changed and regenerate if so.
        if je.entry_date.strftime("%Y-%m") != je_in.entry_date.strftime("%Y-%m"):
            je.transaction_id = await self.generate_transaction_id(org_id, je_in.entry_date)

        self.session.add(je)

        # 5. Handle Lines (Replace existing)
        # Delete old lines
        from sqlalchemy import delete
        await self.session.execute(
            delete(LedgerLine).where(LedgerLine.journal_entry_id == je.id)
        )

        # Add new lines
        for line_in in je_in.lines:
            db_line = LedgerLine(
                journal_entry_id=je.id,
                account_id=line_in.account_id,
                currency_code=line_in.currency_code,
                exchange_rate=line_in.exchange_rate,
                transaction_debit=line_in.transaction_debit,
                transaction_credit=line_in.transaction_credit,
                base_debit=line_in.base_debit,
                base_credit=line_in.base_credit,
                description=line_in.description,
                org_id=org_id,
            )
            self.session.add(db_line)

        await self.session.commit()
        return await self.get_journal_entry_by_id(org_id, je.id)

    async def post_journal_entry(self, org_id: uuid.UUID, je_id: int) -> JournalEntry:
        je = await self.get_journal_entry_by_id(org_id, je_id)
        if not je:
            raise BadRequest("Journal entry not found.")

        if je.status != JournalEntryStatus.DRAFT:
            raise BadRequest(f"Journal entry is already in {je.status} status.")

        # Re-validate the fiscal period
        stmt = select(FiscalPeriod).where(
            and_(FiscalPeriod.id == je.period_id, FiscalPeriod.org_id == org_id)
        )
        period = (await self.session.exec(stmt)).first()
        if not period or period.status != PeriodStatus.OPEN:
            raise BadRequest("Cannot post to a closed or invalid fiscal period.")

        je.status = JournalEntryStatus.POSTED
        self.session.add(je)
        await self.session.commit()
        await self.session.refresh(je)

        return je


def get_journal_entry_service(
    session: AsyncSession = Depends(get_session),
) -> JournalEntryService:
    return JournalEntryService(session=session)
