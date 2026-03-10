from typing import Optional
import uuid
from typing import Optional
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field


class CompanySettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    base_currency_code: str = Field(default="NGN")  # The "Home" currency
    is_base_currency_locked: bool = Field(
        default=False
    )  # Prevents changes after first post


class ExchangeRate(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("org_id", "currency_code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    currency_code: str = Field(index=True, max_length=3)
    rate: float = Field(default=1.0)  # The rate relative to the base currency


class PayrollSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id", unique=True)
    tax_percentage: float = Field(default=15.0)
    benefits_percentage: float = Field(default=5.0)
