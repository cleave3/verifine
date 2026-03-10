from datetime import date
from pydantic import BaseModel, model_validator
from typing import List, Optional
from src.models.journal_entry import JournalEntryStatus


class LedgerLineCreate(BaseModel):
    account_id: int
    currency_code: str = "NGN"
    exchange_rate: float = 1.0
    transaction_debit: float = 0.0
    transaction_credit: float = 0.0
    base_debit: float = 0.0
    base_credit: float = 0.0
    description: Optional[str] = None
    tracking_option_id: Optional[int] = None

    @model_validator(mode="after")
    def check_debit_or_credit(self):
        if self.transaction_debit == 0 and self.transaction_credit == 0:
            raise ValueError(
                "Line must have either a transaction debit or credit amount"
            )
        if self.transaction_debit > 0 and self.transaction_credit > 0:
            raise ValueError(
                "Line cannot have both a transaction debit and a credit amount"
            )
        if self.transaction_debit < 0 or self.transaction_credit < 0:
            raise ValueError("Amounts cannot be negative")

        # Calculate base amounts if they are exactly 0 but transaction amount is > 0
        if self.base_debit == 0 and self.transaction_debit > 0:
            self.base_debit = round(self.transaction_debit * self.exchange_rate, 4)
        if self.base_credit == 0 and self.transaction_credit > 0:
            self.base_credit = round(self.transaction_credit * self.exchange_rate, 4)

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

        total_debits = sum(line.base_debit for line in self.lines)
        total_credits = sum(line.base_credit for line in self.lines)

        # Round to 4 decimal places to prevent floating point issues
        if round(total_debits, 4) != round(total_credits, 4):
            raise ValueError(
                f"Journal entry is out of balance. Base Debits: {total_debits}, Base Credits: {total_credits}"
            )

        return self


class LedgerLineRead(BaseModel):
    id: int
    account_id: int
    currency_code: str
    exchange_rate: float
    transaction_debit: float
    transaction_credit: float
    base_debit: float
    base_credit: float
    description: Optional[str]
    tracking_option_id: Optional[int]


class JournalEntryRead(BaseModel):
    id: int
    transaction_id: str
    description: str
    entry_date: date
    status: JournalEntryStatus
    period_id: int
    created_by_id: int
    lines: List[LedgerLineRead] = []
