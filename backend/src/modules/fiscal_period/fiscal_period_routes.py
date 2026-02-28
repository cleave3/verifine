from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.fiscal_period.fiscal_period_schema import FiscalPeriodCreate
from src.modules.fiscal_period.fiscal_period_service import (
    FiscalPeriodService,
    get_fiscal_period_service,
)
from src.models.fiscal_period import PeriodStatus

router = APIRouter(prefix="/periods", tags=["periods"])


@router.get("/")
async def list_periods(
    period_service: FiscalPeriodService = Depends(get_fiscal_period_service),
):
    periods = await period_service.get_periods()
    return response(
        200, "Periods retrieved successfully", [p.model_dump() for p in periods]
    )


@router.post("/")
async def create_period(
    period_in: FiscalPeriodCreate,
    period_service: FiscalPeriodService = Depends(get_fiscal_period_service),
):
    existing = await period_service.get_period_by_name(period_in.name)
    if existing:
        raise BadRequest(f"Period '{period_in.name}' already exists.")

    if period_in.start_date >= period_in.end_date:
        raise BadRequest("Start date must be before end date.")

    period = await period_service.create_period(period_in)
    return response(201, "Period created successfully", period.model_dump())


@router.patch("/{id}/lock")
async def lock_period(
    id: int, period_service: FiscalPeriodService = Depends(get_fiscal_period_service)
):
    period = await period_service.get_period_by_id(id)
    if not period:
        raise BadRequest("Period not found")

    if period.status != PeriodStatus.OPEN:
        raise BadRequest(f"Cannot lock period with status {period.status}")

    locked_period = await period_service.lock_period(id)
    return response(200, "Period locked successfully", locked_period.model_dump())


@router.patch("/{id}/close")
async def close_period(
    id: int, period_service: FiscalPeriodService = Depends(get_fiscal_period_service)
):
    period = await period_service.get_period_by_id(id)
    if not period:
        raise BadRequest("Period not found")

    if period.status == PeriodStatus.CLOSED:
        raise BadRequest("Period is already closed")

    closed_period = await period_service.close_period(id)
    return response(
        200, "Period sealed and closed successfully", closed_period.model_dump()
    )
