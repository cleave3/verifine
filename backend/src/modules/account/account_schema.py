from datetime import date
from pydantic import BaseModel
from typing import Optional, List
from src.models.journal_entry import JournalEntryStatus
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


class AccountEntryRead(BaseModel):
    id: int
    account_id: int
    journal_entry_id: int
    currency_code: str
    exchange_rate: float
    transaction_debit: float
    transaction_credit: float
    base_debit: float
    base_credit: float
    description: Optional[str]
    is_reconciled: bool
    reconciled_at: Optional[date]
    tracking_option_id: Optional[int]

    # Fields from JournalEntry
    transaction_id: str
    entry_date: date
    header_description: str
    status: JournalEntryStatus


class AccountEntriesResponse(BaseModel):
    results: List[AccountEntryRead]
    meta: dict
