import uuid
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.tenant import get_current_org
from src.utils.common import response
from src.core.security_roles import role_required
from src.models.user import User, UserRole

from .tracking_schema import (
    TrackingCategoryCreate,
    TrackingCategoryResponse,
    TrackingOptionCreate,
    TrackingOptionResponse,
    TrackingCategoryUpdate,
)
from .tracking_service import TrackingService

router = APIRouter(prefix="/tracking", tags=["Tracking Categories"])


def get_tracking_service(
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
):
    return TrackingService(session, org_id)


@router.get("/categories")
async def get_categories(service: TrackingService = Depends(get_tracking_service)):
    data = await service.get_categories()
    return response(200, "Tracking categories retrieved successfully", data)


@router.post("/categories")
async def create_category(
    data: TrackingCategoryCreate,
    service: TrackingService = Depends(get_tracking_service),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
):
    result = await service.create_category(data, current_user.id)
    return response(201, "Tracking category created successfully", result)


@router.post("/categories/{category_id}/options")
async def add_option(
    category_id: int,
    data: TrackingOptionCreate,
    service: TrackingService = Depends(get_tracking_service),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
):
    result = await service.add_option(category_id, data)
    return response(201, "Tracking option added successfully", result)


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    data: TrackingCategoryUpdate,
    service: TrackingService = Depends(get_tracking_service),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
):
    result = await service.update_category(category_id, data, current_user.id)
    return response(200, "Tracking category updated successfully", result)
