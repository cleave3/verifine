import enum
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Enum
from uuid import UUID
from datetime import datetime


class ItemType(str, enum.Enum):
    INVENTORY = "INVENTORY"
    NON_INVENTORY = "NON_INVENTORY"
    SERVICE = "SERVICE"


class Item(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")

    type: ItemType = Field(sa_column=Column(Enum(ItemType)), default=ItemType.INVENTORY)
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None

    # Pricing
    unit_cost: float = Field(default=0.0)
    unit_price: float = Field(default=0.0)

    # Inventory Tracking
    quantity_on_hand: float = Field(default=0.0)

    # Accounting Maps
    income_account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    cogs_account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    asset_account_id: Optional[int] = Field(default=None, foreign_key="account.id")

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
