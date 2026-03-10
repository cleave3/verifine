from pydantic import BaseModel
from datetime import date
from typing import Optional


class FixedAssetCreate(BaseModel):
    asset_name: str
    description: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: date
    purchase_price: float
    salvage_value: float = 0.0
    useful_life_months: int = 12
    asset_account_id: int
    depreciation_expense_account_id: int
    accumulated_depreciation_account_id: int
    tracking_option_id: Optional[int] = None


class DepreciationRunCreate(BaseModel):
    target_date: date
    period_id: int
