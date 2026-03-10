import enum
from datetime import date
from typing import Optional, List
import uuid
from typing import Optional, List
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    VOIDED = "VOIDED"


class JournalEntry(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("org_id", "transaction_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    transaction_id: str = Field(
        index=True, description="Human readable ID like JE-2026-001"
    )
    description: str
    entry_date: date = Field(index=True)
    status: JournalEntryStatus = Field(default=JournalEntryStatus.DRAFT)
    period_id: int = Field(foreign_key="fiscalperiod.id")
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")

    lines: List["LedgerLine"] = Relationship(back_populates="journal_entry")


class LedgerLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    journal_entry_id: int = Field(foreign_key="journalentry.id")
    account_id: int = Field(foreign_key="account.id")

    currency_code: str = Field(default="NGN")
    exchange_rate: float = Field(default=1.0)

    transaction_debit: float = Field(default=0.0)
    transaction_credit: float = Field(default=0.0)
    base_debit: float = Field(default=0.0)
    base_credit: float = Field(default=0.0)
    description: Optional[str] = None
    is_reconciled: bool = Field(default=False)
    reconciled_at: Optional[date] = None
    tracking_option_id: Optional[int] = Field(
        foreign_key="trackingoption.id", default=None, index=True
    )

    journal_entry: JournalEntry = Relationship(back_populates="lines")
