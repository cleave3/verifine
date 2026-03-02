import uuid
from fastapi import APIRouter, Depends
from src.core.tenant import get_current_org
from src.utils.common import response
from src.modules.settings.settings_service import SettingsService, get_settings_service
from src.modules.settings.settings_schema import (
    CompanySettingsUpdate,
    ExchangeRatesUpdate,
)
from src.core.security_roles import role_required
from src.models.user import User, UserRole

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/")
async def get_settings(
    service: SettingsService = Depends(get_settings_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    settings = await service.get_settings(org_id)
    return response(200, "Settings fetched successfully", settings.model_dump())


from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from fastapi import Request


@router.patch("/")
async def update_settings(
    request: Request,
    settings_in: CompanySettingsUpdate,
    service: SettingsService = Depends(get_settings_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN])),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    old_settings = await service.get_settings(org_id)
    prev_state = old_settings.model_dump()

    settings = await service.update_settings(org_id, settings_in)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_COMPANY_SETTINGS",
        entity_type="CompanySettings",
        entity_id=str(settings.id),
        previous_state=prev_state,
        new_state=settings.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Settings updated successfully", settings.model_dump())


@router.post("/lock")
async def lock_currency(
    request: Request,
    service: SettingsService = Depends(get_settings_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN])),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    old_settings = await service.get_settings(org_id)
    prev_state = old_settings.model_dump()

    settings = await service.lock_base_currency(org_id)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="LOCK_BASE_CURRENCY",
        entity_type="CompanySettings",
        entity_id=str(settings.id),
        previous_state=prev_state,
        new_state=settings.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Base currency locked successfully", settings.model_dump())


@router.get("/exchange-rates/{base_currency}")
async def get_exchange_rates(
    base_currency: str,
    service: SettingsService = Depends(get_settings_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    base_currency = base_currency.upper()

    # In a production app you might still fetch dynamically if the DB is empty.
    # We will initialize with some standard defaults if nothing is in the DB.
    db_rates = await service.get_exchange_rates(org_id)

    print("db_rates ===> ", db_rates)

    active_rates = {}
    if not db_rates:
        # Provide defaults if not initialized to avoid empty UI
        if base_currency == "NGN":
            active_rates = {"USD": 1500.0, "EUR": 1650.0, "GBP": 1950.0, "NGN": 1.0}
        else:
            active_rates = {"USD": 1.0, "EUR": 0.92, "GBP": 0.79, "NGN": 1550.0}
    else:
        for r in db_rates:
            active_rates[r.currency_code] = r.rate

    # Include base_currency as 1.0 if not present
    if base_currency not in active_rates:
        active_rates[base_currency] = 1.0

    # Always enforce base currency to be 1.0
    active_rates[base_currency] = 1.0

    return response(
        200,
        "Exchange rates fetched successfully",
        {"base_currency": base_currency, "rates": active_rates},
    )


@router.patch("/exchange-rates")
async def update_exchange_rates(
    rates_in: ExchangeRatesUpdate,
    service: SettingsService = Depends(get_settings_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
    session: AsyncSession = Depends(get_session),
    request: Request = None,
):
    from src.core.audit import log_audit_event

    old_rates = await service.get_exchange_rates(org_id)
    prev_state = {r.currency_code: r.rate for r in old_rates}

    rates = await service.update_exchange_rates(org_id, rates_in)
    new_state = {r.currency_code: r.rate for r in rates}

    client_ip = request.client.host if request and request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_EXCHANGE_RATES",
        entity_type="ExchangeRate",
        entity_id=str(org_id),  # Rates are org-wide
        previous_state=prev_state,
        new_state=new_state,
        ip_address=client_ip,
    )
    await session.commit()

    active_rates = {r.currency_code: r.rate for r in rates}

    return response(200, "Exchange rates updated successfully", {"rates": active_rates})
