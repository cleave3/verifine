from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from enum import Enum


class VendorStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Vendor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: VendorStatus = Field(default=VendorStatus.ACTIVE)
    default_expense_account_id: Optional[int] = Field(
        default=None, foreign_key="account.id"
    )

    bills: List["Bill"] = Relationship(back_populates="vendor")
