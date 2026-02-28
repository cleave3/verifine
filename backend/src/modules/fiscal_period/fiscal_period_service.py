from datetime import datetime, timezone
from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.core.database import get_session
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.modules.fiscal_period.fiscal_period_schema import FiscalPeriodCreate


class FiscalPeriodService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_periods(self) -> Sequence[FiscalPeriod]:
        statement = select(FiscalPeriod).order_by(FiscalPeriod.start_date)
        results = await self.session.exec(statement)
        return results.all()

    async def get_period_by_name(self, name: str) -> Optional[FiscalPeriod]:
        statement = select(FiscalPeriod).where(FiscalPeriod.name == name)
        result = await self.session.exec(statement)
        return result.first()

    async def get_period_by_id(self, period_id: int) -> Optional[FiscalPeriod]:
        return await self.session.get(FiscalPeriod, period_id)

    async def create_period(self, period_in: FiscalPeriodCreate) -> FiscalPeriod:
        db_period = FiscalPeriod(
            name=period_in.name,
            start_date=period_in.start_date,
            end_date=period_in.end_date,
            status=PeriodStatus.OPEN,
        )
        self.session.add(db_period)
        await self.session.commit()
        await self.session.refresh(db_period)
        return db_period

    async def lock_period(self, period_id: int) -> Optional[FiscalPeriod]:
        db_period = await self.get_period_by_id(period_id)
        if not db_period:
            return None

        db_period.status = PeriodStatus.LOCKED
        self.session.add(db_period)
        await self.session.commit()
        await self.session.refresh(db_period)
        return db_period

    async def close_period(self, period_id: int) -> Optional[FiscalPeriod]:
        db_period = await self.get_period_by_id(period_id)
        if not db_period:
            return None

        if db_period.status == PeriodStatus.CLOSED:
            return db_period

        # Here we could implement retaining earnings transfer logic or
        # Trial Balance balanced checks before closing.
        # For simplicity in this demo, we simply mark it closed.

        db_period.status = PeriodStatus.CLOSED
        db_period.closed_at = datetime.now(timezone.utc)
        self.session.add(db_period)
        await self.session.commit()
        await self.session.refresh(db_period)
        return db_period


def get_fiscal_period_service(
    session: AsyncSession = Depends(get_session),
) -> FiscalPeriodService:
    return FiscalPeriodService(session=session)
