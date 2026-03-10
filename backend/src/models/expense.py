from datetime import date, datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import enum
from sqlalchemy import Column, Enum
from uuid import UUID


class ExpenseStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"


class ExpenseClaim(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")
    employee_id: int = Field(foreign_key="employee.id")

    date_incurred: date
    description: str
    amount: float = Field(default=0.0)

    # Financial mapping
    expense_account_id: int = Field(foreign_key="account.id")
    tracking_option_id: Optional[int] = Field(
        default=None, foreign_key="trackingoption.id"
    )

    status: ExpenseStatus = Field(
        sa_column=Column(Enum(ExpenseStatus)), default=ExpenseStatus.SUBMITTED
    )

    journal_entry_id: Optional[int] = Field(default=None, foreign_key="journalentry.id")

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
