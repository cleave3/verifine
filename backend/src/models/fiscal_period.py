import enum
from datetime import date, datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class PeriodStatus(str, enum.Enum):
    OPEN = "OPEN"
    LOCKED = "LOCKED"
    CLOSED = "CLOSED"


class FiscalPeriod(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, description="e.g., March 2026")
    start_date: date
    end_date: date
    status: PeriodStatus = Field(default=PeriodStatus.OPEN)
    closed_at: Optional[datetime] = None
