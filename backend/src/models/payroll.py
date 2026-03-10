from datetime import date, datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import enum
from sqlalchemy import Column, Enum


from uuid import UUID


class RunStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PAID = "PAID"


class Employee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")
    first_name: str
    last_name: str
    email: str
    department_option_id: Optional[int] = Field(
        default=None,
        foreign_key="trackingoption.id",
        description="Used to allocate payroll costs dimensionally",
    )
    base_salary: float = Field(default=0.0)
    is_active: bool = Field(default=True)
    hire_date: Optional[date] = None

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class PayrollRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")
    period_id: int = Field(foreign_key="fiscalperiod.id")

    pay_date: date
    status: RunStatus = Field(
        sa_column=Column(Enum(RunStatus)), default=RunStatus.DRAFT
    )

    total_gross_pay: float = Field(default=0.0)
    total_deductions: float = Field(default=0.0)
    total_net_pay: float = Field(default=0.0)
    total_taxes: float = Field(default=0.0)

    journal_entry_id: Optional[int] = Field(default=None, foreign_key="journalentry.id")

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class PaySlip(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")
    payroll_run_id: int = Field(foreign_key="payrollrun.id")
    employee_id: int = Field(foreign_key="employee.id")

    gross_pay: float = Field(default=0.0)
    tax_deduction: float = Field(default=0.0)
    benefits_deduction: float = Field(default=0.0)
    net_pay: float = Field(default=0.0)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
