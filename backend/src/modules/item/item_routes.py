import uuid
from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_session
from src.core.security_roles import get_current_user, role_required
from src.core.tenant import get_current_org
from src.core.audit import log_audit_event
from src.utils.common import response
from src.models.user import User, UserRole
from src.modules.item.item_schema import ItemCreate, ItemUpdate
from src.modules.item.item_service import ItemService, get_item_service

router = APIRouter(prefix="/items", tags=["Inventory Items"])


@router.post("")
async def create_item(
    request: Request,
    payload: ItemCreate,
    item_service: ItemService = Depends(get_item_service),
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
):
    item = await item_service.create_item(org_id, payload)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CREATE_ITEM",
        entity_type="Item",
        entity_id=str(item.id),
        new_state=item.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Item created successfully", item.model_dump())


@router.get("")
async def get_items(
    item_service: ItemService = Depends(get_item_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required(
            [UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT, UserRole.VIEWER]
        )
    ),
):
    items = await item_service.get_items(org_id)
    return response(
        200, "Items retrieved successfully", [i.model_dump() for i in items]
    )


@router.get("/{item_id}")
async def get_item(
    item_id: int,
    item_service: ItemService = Depends(get_item_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required(
            [UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT, UserRole.VIEWER]
        )
    ),
):
    item = await item_service.get_item(org_id, item_id)
    return response(200, "Item retrieved successfully", item.model_dump())


@router.put("/{item_id}")
async def update_item(
    request: Request,
    item_id: int,
    payload: ItemUpdate,
    item_service: ItemService = Depends(get_item_service),
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
):
    old_item = await item_service.get_item(org_id, item_id)
    old_state = old_item.model_dump() if old_item else {}

    item = await item_service.update_item(org_id, item_id, payload)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_ITEM",
        entity_type="Item",
        entity_id=str(item.id),
        old_state=old_state,
        new_state=item.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Item updated successfully", item.model_dump())
