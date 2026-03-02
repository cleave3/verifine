import uuid
from typing import Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.models.organization import Organization
from src.modules.organization.organization_schema import OrganizationUpdate


class OrganizationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_organization(self, org_id: uuid.UUID) -> Optional[Organization]:
        return await self.session.get(Organization, org_id)

    async def update_organization(
        self, org_id: uuid.UUID, org_in: OrganizationUpdate
    ) -> Optional[Organization]:
        db_org = await self.get_organization(org_id)
        if not db_org:
            return None

        update_data = org_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_org, key, value)

        self.session.add(db_org)
        await self.session.commit()
        await self.session.refresh(db_org)
        return db_org


def get_organization_service(
    session: AsyncSession = Depends(get_session),
) -> OrganizationService:
    return OrganizationService(session)
