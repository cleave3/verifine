from datetime import date
from pydantic import BaseModel, model_validator
from typing import List, Optional
from src.models.journal_entry import JournalEntryStatus


class LedgerLineCreate(BaseModel):
    account_id: int
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = None

    @model_validator(mode="after")
    def check_debit_or_credit(self):
        if self.debit == 0 and self.credit == 0:
            raise ValueError("Line must have either a debit or a credit amount")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("Line cannot have both a debit and a credit amount")
        if self.debit < 0 or self.credit < 0:
            raise ValueError("Amounts cannot be negative")
        return self


class JournalEntryCreate(BaseModel):
    description: str
    entry_date: date
    period_id: int
    lines: List[LedgerLineCreate]

    @model_validator(mode="after")
    def check_balance_and_lines(self):
        if not self.lines or len(self.lines) < 2:
            raise ValueError("A journal entry must have at least two lines")

        total_debits = sum(line.debit for line in self.lines)
        total_credits = sum(line.credit for line in self.lines)

        # Round to 4 decimal places to prevent floating point issues
        if round(total_debits, 4) != round(total_credits, 4):
            raise ValueError(
                f"Journal entry is out of balance. Debits: {total_debits}, Credits: {total_credits}"
            )

        return self


class LedgerLineRead(BaseModel):
    id: int
    account_id: int
    debit: float
    credit: float
    description: Optional[str]


class JournalEntryRead(BaseModel):
    id: int
    transaction_id: str
    description: str
    entry_date: date
    status: JournalEntryStatus
    period_id: int
    created_by_id: int
    lines: List[LedgerLineRead] = []
