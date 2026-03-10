from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship


class TrackingCategoryBase(SQLModel):
    name: str = Field(description="e.g., Department, Region")
    description: Optional[str] = None
    is_active: bool = Field(default=True)


import uuid


class TrackingCategory(TrackingCategoryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")

    options: List["TrackingOption"] = Relationship(
        back_populates="category",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class TrackingOptionBase(SQLModel):
    category_id: int = Field(foreign_key="trackingcategory.id")
    name: str = Field(description="e.g., Sales, Marketing")
    is_active: bool = Field(default=True)


class TrackingOption(TrackingOptionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: TrackingCategory = Relationship(back_populates="options")
