from decimal import Decimal
from typing import Optional
import uuid
from sqlmodel import SQLModel, Field, Relationship


class TaxRate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    name: str = Field(index=True, description="e.g., VAT 7.5%")
    rate: Decimal = Field(
        default=0.0,
        max_digits=5,
        decimal_places=4,
        description="Rate as decimal. 7.5% = 0.075",
    )
    account_id: int = Field(
        foreign_key="account.id", description="Liability/Asset account for this tax"
    )
    is_active: bool = Field(default=True)
    description: Optional[str] = None
