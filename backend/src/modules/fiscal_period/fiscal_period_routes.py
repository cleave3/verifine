import uuid
from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.errors import BadRequest
from src.utils.common import response
from src.core.tenant import get_current_org
from src.modules.fiscal_period.fiscal_period_schema import (
    FiscalPeriodCreate,
    FiscalPeriodClose,
)
from src.modules.fiscal_period.fiscal_period_service import (
    FiscalPeriodService,
    get_fiscal_period_service,
)
from src.models.fiscal_period import PeriodStatus
from src.models.user import User, UserRole
from src.core.security_roles import role_required

router = APIRouter(prefix="/periods", tags=["periods"])


@router.get("/")
async def list_periods(
    period_service: FiscalPeriodService = Depends(get_fiscal_period_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    periods = await period_service.get_periods(org_id)
    return response(
        200, "Periods retrieved successfully", [p.model_dump() for p in periods]
    )


@router.post("/")
async def create_period(
    period_in: FiscalPeriodCreate,
    period_service: FiscalPeriodService = Depends(get_fiscal_period_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    existing = await period_service.get_period_by_name(org_id, period_in.name)
    if existing:
        raise BadRequest(f"Period '{period_in.name}' already exists.")

    if period_in.start_date >= period_in.end_date:
        raise BadRequest("Start date must be before end date.")

    period = await period_service.create_period(org_id, period_in)
    return response(201, "Period created successfully", period.model_dump())


@router.patch("/{id}/lock")
async def lock_period(
    request: Request,
    id: int,
    period_service: FiscalPeriodService = Depends(get_fiscal_period_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    period = await period_service.get_period_by_id(org_id, id)
    if not period:
        raise BadRequest("Period not found")

    if period.status != PeriodStatus.OPEN:
        raise BadRequest(f"Cannot lock period with status {period.status}")

    prev_state = period.model_dump()
    locked_period = await period_service.lock_period(org_id, id)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="LOCK_FISCAL_PERIOD",
        entity_type="FiscalPeriod",
        entity_id=str(locked_period.id),
        previous_state=prev_state,
        new_state=locked_period.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Period locked successfully", locked_period.model_dump())


@router.patch("/{id}/close")
async def close_period(
    request: Request,
    id: int,
    request_data: FiscalPeriodClose,
    period_service: FiscalPeriodService = Depends(get_fiscal_period_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    period = await period_service.get_period_by_id(org_id, id)
    if not period:
        raise BadRequest("Period not found")

    if period.status == PeriodStatus.CLOSED:
        raise BadRequest("Period is already closed")

    prev_state = period.model_dump()
    closed_period = await period_service.close_period(
        org_id, id, request_data.retained_earnings_account_id
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CLOSE_FISCAL_PERIOD",
        entity_type="FiscalPeriod",
        entity_id=str(closed_period.id),
        previous_state=prev_state,
        new_state=closed_period.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(
        200, "Period sealed and closed successfully", closed_period.model_dump()
    )
