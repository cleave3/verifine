from typing import Optional
from sqlmodel import SQLModel, Field

class CompanySettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    base_currency_code: str = Field(default="NGN") # The "Home" currency
    is_base_currency_locked: bool = Field(default=False) # Prevents changes after first post

class ExchangeRate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    currency_code: str = Field(index=True, max_length=3, unique=True)
    rate: float = Field(default=1.0) # The rate relative to the base currency
