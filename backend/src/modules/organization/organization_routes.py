import uuid
from fastapi import APIRouter, Depends
from src.core.tenant import get_current_org
from src.utils.common import response
from src.core.errors import BadRequest
from src.modules.organization.organization_schema import OrganizationUpdate
from src.core.security_roles import get_current_user
from src.models.user import User
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from fastapi import Request
from src.modules.organization.organization_service import (
    OrganizationService,
    get_organization_service,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/me")
async def get_my_organization(
    org_service: OrganizationService = Depends(get_organization_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    org = await org_service.get_organization(org_id)
    if not org:
        raise BadRequest("Organization not found")
    return response(200, "Organization fetched successfully", org.model_dump())


@router.patch("/me")
async def update_my_organization(
    request: Request,
    org_in: OrganizationUpdate,
    org_service: OrganizationService = Depends(get_organization_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    old_org = await org_service.get_organization(org_id)
    prev_state = old_org.model_dump() if old_org else None

    org = await org_service.update_organization(org_id, org_in)
    if not org:
        raise BadRequest("Organization not found")

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_ORGANIZATION",
        entity_type="Organization",
        entity_id=str(org_id),
        previous_state=prev_state,
        new_state=org.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Organization updated successfully", org.model_dump())
