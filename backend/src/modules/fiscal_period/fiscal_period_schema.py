from datetime import date
from pydantic import BaseModel
from src.models.fiscal_period import PeriodStatus


class FiscalPeriodCreate(BaseModel):
    name: str
    start_date: date
    end_date: date


class FiscalPeriodRead(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    status: PeriodStatus
    closed_at: str | None = None


class FiscalPeriodClose(BaseModel):
    retained_earnings_account_id: int
