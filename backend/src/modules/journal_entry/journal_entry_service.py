from datetime import datetime
from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from src.core.database import get_session
from src.models.journal_entry import JournalEntry, LedgerLine, JournalEntryStatus
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.modules.journal_entry.journal_entry_schema import JournalEntryCreate
from src.core.errors import BadRequest


class JournalEntryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_journal_entries(self) -> Sequence[JournalEntry]:
        statement = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .order_by(JournalEntry.id.desc())
        )
        results = await self.session.exec(statement)
        return results.all()

    async def get_journal_entry_by_id(self, je_id: int) -> Optional[JournalEntry]:
        statement = (
            select(JournalEntry)
            .where(JournalEntry.id == je_id)
            .options(selectinload(JournalEntry.lines))
        )
        result = await self.session.exec(statement)
        return result.first()

    async def generate_transaction_id(self, entry_date: datetime.date) -> str:
        year_month = entry_date.strftime("%Y-%m")
        prefix = f"JE-{year_month}-"

        statement = select(JournalEntry).where(
            JournalEntry.transaction_id.startswith(prefix)
        )
        results = await self.session.exec(statement)
        existing_entries = results.all()
        next_num = len(existing_entries) + 1

        return f"{prefix}{next_num:04d}"

    async def create_journal_entry(
        self, je_in: JournalEntryCreate, user_id: int
    ) -> JournalEntry:
        # 1. Validate the fiscal period
        period = await self.session.get(FiscalPeriod, je_in.period_id)
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
        transaction_id = await self.generate_transaction_id(je_in.entry_date)

        # 3. Create the Journal Entry
        db_je = JournalEntry(
            transaction_id=transaction_id,
            description=je_in.description,
            entry_date=je_in.entry_date,
            period_id=je_in.period_id,
            created_by_id=user_id,
            status=JournalEntryStatus.POSTED,
        )

        self.session.add(db_je)
        await self.session.flush()

        # 4. Create Ledger Lines
        for line_in in je_in.lines:
            db_line = LedgerLine(
                journal_entry_id=db_je.id,
                account_id=line_in.account_id,
                debit=line_in.debit,
                credit=line_in.credit,
                description=line_in.description,
            )
            self.session.add(db_line)

        # 5. Commit atomically
        await self.session.commit()

        return await self.get_journal_entry_by_id(db_je.id)


def get_journal_entry_service(
    session: AsyncSession = Depends(get_session),
) -> JournalEntryService:
    return JournalEntryService(session=session)
