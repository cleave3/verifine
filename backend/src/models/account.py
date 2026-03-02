import enum
from sqlmodel import SQLModel, Field
from typing import Optional
import uuid
from sqlalchemy import UniqueConstraint


class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"


class Account(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("org_id", "code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    code: str = Field(index=True, description="Account Number (e.g., 1000)")
    name: str = Field(index=True)
    type: AccountType
    is_active: bool = Field(default=True)
    description: Optional[str] = None
