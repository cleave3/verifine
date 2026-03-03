import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.tenant import get_current_org
from src.core.security_roles import role_required
from src.models.user import UserRole
from src.utils.common import response
from src.modules.audit.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["audit"])


def get_audit_service(session: AsyncSession = Depends(get_session)) -> AuditService:
    return AuditService(session)


@router.get(
    "",
    dependencies=[
        Depends(
            role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
        )
    ],
)
async def list_audit_logs(
    page: int = 1,
    page_size: int = 10,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    audit_service: AuditService = Depends(get_audit_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    """
    Retrieve paginated audit logs for the current organization.
    Restricted to Admins and Controllers due to sensitive historic data.
    """
    logs_data = await audit_service.get_audit_logs(
        org_id=org_id, page=page, page_size=page_size, user_id=user_id, action=action
    )

    return response(200, "Audit logs retrieved successfully", logs_data)
