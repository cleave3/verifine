from typing import Optional, List
from datetime import date
from decimal import Decimal
from sqlmodel import Field, SQLModel, Relationship


import uuid


class BankStatementBase(SQLModel):
    account_id: int = Field(
        foreign_key="account.id", description="The asset account representing the bank"
    )
    statement_date: date
    start_balance: Decimal = Field(max_digits=20, decimal_places=4, default=0)
    end_balance: Decimal = Field(max_digits=20, decimal_places=4, default=0)
    status: str = Field(default="DRAFT", description="DRAFT, RECONCILED")


class BankStatement(BankStatementBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")

    # Relationships
    lines: List["BankStatementLine"] = Relationship(
        back_populates="statement",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class BankStatementLineBase(SQLModel):
    statement_id: int = Field(foreign_key="bankstatement.id")
    date: date
    description: str
    amount: Decimal = Field(max_digits=20, decimal_places=4)
    reference: Optional[str] = None
    is_reconciled: bool = Field(default=False)
    matched_journal_line_id: Optional[int] = Field(
        foreign_key="ledgerline.id", default=None
    )


class BankStatementLine(BankStatementLineBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Relationships
    statement: BankStatement = Relationship(back_populates="lines")
