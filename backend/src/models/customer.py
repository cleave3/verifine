from typing import Optional, List
import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from enum import Enum


class CustomerStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Customer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    name: str = Field(index=True)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: CustomerStatus = Field(default=CustomerStatus.ACTIVE)
    default_revenue_account_id: Optional[int] = Field(
        default=None, foreign_key="account.id"
    )

    invoices: List["Invoice"] = Relationship(back_populates="customer")
