from typing import List
from pydantic import BaseModel


class TrialBalanceLine(BaseModel):
    account_code: str
    account_name: str
    normal_balance: str  # DEBIT or CREDIT
    debit: float
    credit: float


class TrialBalanceReport(BaseModel):
    period_id: int
    lines: List[TrialBalanceLine]
    total_debit: float
    total_credit: float
    is_balanced: bool


class PLAccountLine(BaseModel):
    account_code: str
    account_name: str
    balance: float


class PLReport(BaseModel):
    period_id: int
    revenue_lines: List[PLAccountLine]
    total_revenue: float
    expense_lines: List[PLAccountLine]
    total_expenses: float
    net_income: float


class BalanceSheetAccountLine(BaseModel):
    account_code: str
    account_name: str
    balance: float


class BalanceSheetReport(BaseModel):
    period_id: int
    assets_lines: List[BalanceSheetAccountLine]
    total_assets: float
    liabilities_lines: List[BalanceSheetAccountLine]
    total_liabilities: float
    equity_lines: List[BalanceSheetAccountLine]
    total_equity: float
    total_liabilities_and_equity: float
    is_balanced: bool
