import uuid
from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, and_

from src.core.database import get_session
from src.models.tax import TaxRate
from src.modules.tax.tax_schema import TaxRateCreate, TaxRateUpdate
from src.core.errors import BadRequest
from src.core.audit import log_audit_event


class TaxService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_tax_rates(self, org_id: uuid.UUID) -> Sequence[TaxRate]:
        statement = (
            select(TaxRate).where(TaxRate.org_id == org_id).order_by(TaxRate.name)
        )
        results = await self.session.exec(statement)
        return results.all()

    async def get_tax_rate_by_id(
        self, org_id: uuid.UUID, tax_rate_id: int
    ) -> Optional[TaxRate]:
        statement = select(TaxRate).where(
            and_(TaxRate.id == tax_rate_id, TaxRate.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_tax_rate(
        self, org_id: uuid.UUID, tax_in: TaxRateCreate, user_id: int
    ) -> TaxRate:
        db_tax = TaxRate(**tax_in.model_dump(), org_id=org_id)
        self.session.add(db_tax)
        await self.session.commit()
        await self.session.refresh(db_tax)

        # Log audit event requires serializable dictionary
        try:
            dumped_state = {
                "id": db_tax.id,
                "name": db_tax.name,
                "rate": float(db_tax.rate),
                "account_id": db_tax.account_id,
                "is_active": db_tax.is_active,
            }
        except:
            dumped_state = {"id": db_tax.id, "name": db_tax.name}

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="CREATE_TAXRATE",
            entity_type="TaxRate",
            entity_id=str(db_tax.id),
            previous_state=None,
            new_state=dumped_state,
        )
        await self.session.commit()
        return db_tax

    async def update_tax_rate(
        self, org_id: uuid.UUID, tax_rate_id: int, tax_in: TaxRateUpdate, user_id: int
    ) -> Optional[TaxRate]:
        db_tax = await self.get_tax_rate_by_id(org_id, tax_rate_id)
        if not db_tax:
            return None

        # Capture previous state
        try:
            prev_state = {
                "id": db_tax.id,
                "name": db_tax.name,
                "rate": float(db_tax.rate),
                "account_id": db_tax.account_id,
                "is_active": db_tax.is_active,
            }
        except:
            prev_state = {"id": db_tax.id, "name": db_tax.name}

        update_data = tax_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_tax, key, value)

        self.session.add(db_tax)
        await self.session.commit()
        await self.session.refresh(db_tax)

        try:
            new_state = {
                "id": db_tax.id,
                "name": db_tax.name,
                "rate": float(db_tax.rate),
                "account_id": db_tax.account_id,
                "is_active": db_tax.is_active,
            }
        except:
            new_state = {"id": db_tax.id, "name": db_tax.name}

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="UPDATE_TAXRATE",
            entity_type="TaxRate",
            entity_id=str(db_tax.id),
            previous_state=prev_state,
            new_state=new_state,
        )
        await self.session.commit()
        return db_tax


def get_tax_service(session: AsyncSession = Depends(get_session)) -> TaxService:
    return TaxService(session=session)
