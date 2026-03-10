from datetime import date
from pydantic import BaseModel
from typing import Optional


class PayrollSettingsRead(BaseModel):
    tax_percentage: float
    benefits_percentage: float


class PayrollSettingsUpdate(BaseModel):
    tax_percentage: Optional[float] = None
    benefits_percentage: Optional[float] = None


class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    department_option_id: Optional[int] = None
    base_salary: float = 0.0
    hire_date: Optional[date] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    department_option_id: Optional[int] = None
    base_salary: Optional[float] = None
    is_active: Optional[bool] = None
    hire_date: Optional[date] = None


class PayrollRunCreate(BaseModel):
    period_id: int
    pay_date: date


class PayrollRunConfirm(BaseModel):
    wages_expense_account_id: int
    payroll_liabilities_account_id: int
    cash_account_id: int
