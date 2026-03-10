from pydantic import BaseModel
from typing import Optional
from datetime import date


class ExpenseClaimCreate(BaseModel):
    employee_id: int
    date_incurred: date
    description: str
    amount: float
    expense_account_id: int
    tracking_option_id: Optional[int] = None


class ExpenseClaimApprove(BaseModel):
    credit_account_id: int
    period_id: int
