import uuid
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.utils.common import response
from src.core.tenant import get_current_org
from src.modules.dashboard.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(
    session: AsyncSession = Depends(get_session),
    org_id: uuid.UUID = Depends(get_current_org),
):
    service = DashboardService(session)
    data = await service.get_dashboard_summary(org_id)
    return response(200, "Dashboard data retrieved", data)
