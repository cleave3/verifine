from pydantic import BaseModel
from typing import Optional
from src.models.account import AccountType


class AccountCreate(BaseModel):
    code: str
    name: str
    type: AccountType
    description: Optional[str] = None
    is_active: bool = True


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class AccountRead(BaseModel):
    id: int
    code: str
    name: str
    type: AccountType
    is_active: bool
    description: Optional[str]
