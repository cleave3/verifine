import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from fastapi import HTTPException

from src.models.item import Item
from src.modules.item.item_schema import ItemCreate, ItemUpdate


class ItemService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_item(self, org_id: uuid.UUID, payload: ItemCreate) -> Item:
        item = Item(**payload.model_dump(), organization_id=org_id)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def get_items(self, org_id: uuid.UUID) -> List[Item]:
        stmt = select(Item).where(Item.organization_id == org_id)
        result = await self.session.exec(stmt)
        return list(result.all())

    async def get_item(self, org_id: uuid.UUID, item_id: int) -> Optional[Item]:
        stmt = select(Item).where(Item.id == item_id, Item.organization_id == org_id)
        item = (await self.session.exec(stmt)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item

    async def update_item(
        self, org_id: uuid.UUID, item_id: int, payload: ItemUpdate
    ) -> Item:
        item = await self.get_item(org_id, item_id)

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)

        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item


from fastapi import Depends
from src.core.database import get_session


def get_item_service(session: AsyncSession = Depends(get_session)) -> ItemService:
    return ItemService(session)
