from datetime import date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel


class BankStatementLineCreate(BaseModel):
    date: date
    description: str
    amount: Decimal
    reference: Optional[str] = None


class BankStatementCreate(BaseModel):
    account_id: int
    statement_date: date
    start_balance: Decimal
    end_balance: Decimal
    lines: List[BankStatementLineCreate]


class MatchLineRequest(BaseModel):
    bank_line_id: int
    ledger_line_id: int


class BankStatementLineResponse(BaseModel):
    id: int
    date: date
    description: str
    amount: Decimal
    reference: Optional[str]
    is_reconciled: bool
    matched_journal_line_id: Optional[int]

    class Config:
        from_attributes = True


class BankStatementResponse(BaseModel):
    id: int
    account_id: int
    statement_date: date
    start_balance: Decimal
    end_balance: Decimal
    status: str
    lines: List[BankStatementLineResponse]

    class Config:
        from_attributes = True


class MatchSuggestion(BaseModel):
    bank_line_id: int
    ledger_line_id: int
    confidence: str  # "HIGH", "MEDIUM", "LOW"
