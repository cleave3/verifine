import enum
from sqlmodel import SQLModel, Field
from typing import Optional


class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(
        unique=True, index=True, description="Account Number (e.g., 1000)"
    )
    name: str = Field(index=True)
    type: AccountType
    is_active: bool = Field(default=True)
    description: Optional[str] = None
