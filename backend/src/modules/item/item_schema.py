from pydantic import BaseModel
from typing import Optional
from src.models.item import ItemType


class ItemCreate(BaseModel):
    type: ItemType
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity_on_hand: Optional[int] = 0
    unit_cost: float = 0.0
    unit_price: float = 0.0
    income_account_id: Optional[int] = None
    cogs_account_id: Optional[int] = None
    asset_account_id: Optional[int] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity_on_hand: Optional[int] = None
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    income_account_id: Optional[int] = None
    cogs_account_id: Optional[int] = None
    asset_account_id: Optional[int] = None
