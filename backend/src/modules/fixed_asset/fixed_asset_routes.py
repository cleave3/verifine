from typing import List
import uuid
from datetime import date
from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.core.security_roles import get_current_user, role_required
from src.core.tenant import get_current_org
from src.core.audit import log_audit_event
from src.utils.common import response
from src.models.user import User, UserRole
from src.models.fixed_asset import FixedAsset, DepreciationSchedule
from src.modules.fixed_asset.fixed_asset_schema import (
    FixedAssetCreate,
    DepreciationRunCreate,
)
from src.modules.fixed_asset.fixed_asset_service import (
    FixedAssetService,
    get_fixed_asset_service,
)

router = APIRouter(prefix="/fixed-assets", tags=["Fixed Assets"])


@router.post("")
async def create_asset(
    request: Request,
    payload: FixedAssetCreate,
    fixed_asset_service: FixedAssetService = Depends(get_fixed_asset_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    asset = await fixed_asset_service.create_asset(org_id, payload)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CREATE_FIXED_ASSET",
        entity_type="FixedAsset",
        entity_id=str(asset.id),
        new_state=asset.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Fixed asset created successfully", asset.model_dump())


@router.get("")
async def get_assets(
    fixed_asset_service: FixedAssetService = Depends(get_fixed_asset_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    assets = await fixed_asset_service.get_assets(org_id)
    return response(
        200, "Fixed assets retrieved successfully", [a.model_dump() for a in assets]
    )


@router.get("/{asset_id}")
async def get_asset(
    asset_id: int,
    fixed_asset_service: FixedAssetService = Depends(get_fixed_asset_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    asset = await fixed_asset_service.get_asset(org_id, asset_id)
    return response(200, "Fixed asset retrieved successfully", asset.model_dump())


@router.post("/{asset_id}/dispose")
async def dispose_asset(
    request: Request,
    asset_id: int,
    fixed_asset_service: FixedAssetService = Depends(get_fixed_asset_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    old_asset = await fixed_asset_service.get_asset(org_id, asset_id)
    old_state = old_asset.model_dump()

    asset = await fixed_asset_service.dispose_asset(org_id, asset_id)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="DISPOSE_FIXED_ASSET",
        entity_type="FixedAsset",
        entity_id=str(asset.id),
        old_state=old_state,
        new_state=asset.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Fixed asset disposed successfully", asset.model_dump())


@router.post("/depreciate")
async def run_depreciation(
    request: Request,
    payload: DepreciationRunCreate,
    fixed_asset_service: FixedAssetService = Depends(get_fixed_asset_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    schedules = await fixed_asset_service.run_depreciation(
        org_id, current_user.id, payload.target_date, payload.period_id
    )

    schedules_dump = [s.model_dump() for s in schedules]

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="RUN_DEPRECIATION",
        entity_type="DepreciationSchedule",
        entity_id="batch",
        new_state={"schedules": schedules_dump},
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Depreciation run completed successfully", schedules_dump)
