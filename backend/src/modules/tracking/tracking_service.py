import uuid
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from fastapi import HTTPException
from src.models.tracking import TrackingCategory, TrackingOption
from src.core.audit import log_audit_event
from .tracking_schema import (
    TrackingCategoryCreate,
    TrackingCategoryResponse,
    TrackingOptionCreate,
    TrackingCategoryUpdate,
)

from sqlalchemy.orm import selectinload


class TrackingService:
    def __init__(self, session: AsyncSession, current_org_id: uuid.UUID):
        self.session = session
        self.org_id = current_org_id

    async def get_categories(self) -> list[TrackingCategory]:
        categories = await self.session.exec(
            select(TrackingCategory)
            .options(selectinload(TrackingCategory.options))
            .where(TrackingCategory.org_id == self.org_id)
        )
        return [c.__dict__ for c in categories.all()]

    async def create_category(
        self, data: TrackingCategoryCreate, user_id: int
    ) -> TrackingCategory:
        category = TrackingCategory(
            org_id=self.org_id,
            name=data.name,
            description=data.description,
            is_active=data.is_active,
        )
        self.session.add(category)
        await self.session.flush()

        for opt in data.options:
            option = TrackingOption(
                category_id=category.id, name=opt.name, is_active=opt.is_active
            )
            self.session.add(option)

        await self.session.commit()
        await self.session.refresh(category)

        await log_audit_event(
            session=self.session,
            org_id=self.org_id,
            user_id=user_id,
            action="CREATE_TRACKING_CATEGORY",
            entity_type="TrackingCategory",
            entity_id=str(category.id),
            previous_state=None,
            new_state=category,
        )
        return category

    async def add_option(
        self, category_id: int, opt: TrackingOptionCreate
    ) -> TrackingOption:
        category = await self.session.get(TrackingCategory, category_id)
        if not category or category.org_id != self.org_id:
            raise HTTPException(status_code=404, detail="Category not found")

        option = TrackingOption(
            category_id=category.id, name=opt.name, is_active=opt.is_active
        )
        self.session.add(option)
        await self.session.commit()
        await self.session.refresh(option)
        return option

    async def update_category(
        self, category_id: int, data: TrackingCategoryUpdate, user_id: int
    ) -> TrackingCategory:
        category = await self.session.get(TrackingCategory, category_id)
        if not category or category.org_id != self.org_id:
            raise HTTPException(status_code=404, detail="Category not found")

        # Load existing options
        await self.session.refresh(category, ["options"])

        try:
            prev_state = {
                "name": category.name,
                "description": category.description,
                "is_active": category.is_active,
                "options": [
                    {"id": opt.id, "name": opt.name, "is_active": opt.is_active}
                    for opt in category.options
                ],
            }
        except:
            prev_state = {"id": category.id, "name": category.name}

        if data.name is not None:
            category.name = data.name
        if data.description is not None:
            category.description = data.description
        if data.is_active is not None:
            category.is_active = data.is_active

        if data.options is not None:
            existing_options = {opt.id: opt for opt in category.options}
            new_options_input = []
            updated_option_ids = set()

            for opt_in in data.options:
                if opt_in.id:
                    # Update existing option
                    if opt_in.id in existing_options:
                        existing_opt = existing_options[opt_in.id]
                        existing_opt.name = opt_in.name
                        existing_opt.is_active = opt_in.is_active
                        updated_option_ids.add(opt_in.id)
                else:
                    new_options_input.append(opt_in)

            # Delete options that were not passed in
            for opt_id, existing_opt in existing_options.items():
                if opt_id not in updated_option_ids:
                    await self.session.delete(existing_opt)

            # Add new options
            for opt_in in new_options_input:
                new_option = TrackingOption(
                    category_id=category.id,
                    name=opt_in.name,
                    is_active=opt_in.is_active,
                )
                self.session.add(new_option)

        self.session.add(category)
        await self.session.flush()

        try:
            await self.session.refresh(category, ["options"])
            new_state = {
                "name": category.name,
                "description": category.description,
                "is_active": category.is_active,
                "options": [
                    {"id": opt.id, "name": opt.name, "is_active": opt.is_active}
                    for opt in category.options
                ],
            }
        except:
            new_state = {"id": category.id, "name": category.name}

        await log_audit_event(
            session=self.session,
            org_id=self.org_id,
            user_id=user_id,
            action="UPDATE_TRACKING_CATEGORY",
            entity_type="TrackingCategory",
            entity_id=str(category.id),
            previous_state=prev_state,
            new_state=new_state,
        )

        await self.session.commit()
        await self.session.refresh(category)
        return category
