import enum
from datetime import date
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    VOIDED = "VOIDED"


class JournalEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    transaction_id: str = Field(
        unique=True, index=True, description="Human readable ID like JE-2026-001"
    )
    description: str
    entry_date: date = Field(index=True)
    status: JournalEntryStatus = Field(default=JournalEntryStatus.DRAFT)
    period_id: int = Field(foreign_key="fiscalperiod.id")
    created_by_id: int = Field(foreign_key="user.id")

    lines: List["LedgerLine"] = Relationship(back_populates="journal_entry")


class LedgerLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    journal_entry_id: int = Field(foreign_key="journalentry.id")
    account_id: int = Field(foreign_key="account.id")
    
    currency_code: str = Field(default="NGN")
    exchange_rate: float = Field(default=1.0)
    
    transaction_debit: float = Field(default=0.0)
    transaction_credit: float = Field(default=0.0)
    base_debit: float = Field(default=0.0)
    base_credit: float = Field(default=0.0)
    description: Optional[str] = None

    journal_entry: JournalEntry = Relationship(back_populates="lines")
