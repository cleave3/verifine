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
        self, org_id: uuid.UUID, period_id: int
    ) -> Optional[FiscalPeriod]:
        db_period = await self.get_period_by_id(org_id, period_id)
        if not db_period:
            return None

        if db_period.status == PeriodStatus.CLOSED:
            return db_period

        # Here we could implement retaining earnings transfer logic or
        # Trial Balance balanced checks before closing.
        # For simplicity in this demo, we simply mark it closed.

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
