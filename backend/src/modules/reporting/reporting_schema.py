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


class TaxLiabilityLine(BaseModel):
    tax_rate_id: int
    tax_rate_name: str
    tax_rate_percentage: float
    total_collected: float
    total_paid: float
    net_liability: float


class TaxLiabilityReport(BaseModel):
    period_id: int
    lines: List[TaxLiabilityLine]
    total_collected: float
    total_paid: float
    net_liability_total: float
