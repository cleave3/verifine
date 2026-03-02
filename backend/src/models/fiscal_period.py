import enum
from datetime import date, datetime
from typing import Optional
from typing import Optional
import uuid
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field


class PeriodStatus(str, enum.Enum):
    OPEN = "OPEN"
    LOCKED = "LOCKED"
    CLOSED = "CLOSED"


class FiscalPeriod(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("org_id", "name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    name: str = Field(index=True, description="e.g., March 2026")
    start_date: date
    end_date: date
    status: PeriodStatus = Field(default=PeriodStatus.OPEN)
    closed_at: Optional[datetime] = None
