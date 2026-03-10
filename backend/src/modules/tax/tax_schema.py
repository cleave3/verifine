from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class TaxRateBase(BaseModel):
    name: str
    rate: Decimal
    account_id: int
    is_active: bool = True
    description: Optional[str] = None


class TaxRateCreate(TaxRateBase):
    pass


class TaxRateUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    account_id: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class TaxRateRead(TaxRateBase):
    id: int
