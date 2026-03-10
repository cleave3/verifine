from typing import Optional, List
import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from enum import Enum


class BillStatus(str, Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    POSTED = "POSTED"
    PAID = "PAID"
    VOID = "VOID"


class Bill(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    vendor_id: int = Field(foreign_key="vendor.id")
    bill_number: str = Field(index=True)  # Vendor's invoice number
    bill_date: date
    due_date: date
    status: BillStatus = Field(default=BillStatus.DRAFT)

    currency_code: str = Field(default="NGN")
    exchange_rate: float = Field(default=1.0)
    total_amount: float = Field(default=0.0)
    base_total_amount: float = Field(default=0.0)
    notes: Optional[str] = None

    # Optional link to the generated Journal Entry once posted
    journal_entry_id: Optional[int] = Field(default=None, foreign_key="journalentry.id")

    vendor: "Vendor" = Relationship(back_populates="bills")
    lines: List["BillLineItem"] = Relationship(back_populates="bill")


class BillLineItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    item_id: Optional[int] = Field(default=None, foreign_key="item.id")
    bill_id: int = Field(foreign_key="bill.id")
    account_id: int = Field(foreign_key="account.id")  # Expense account
    description: str
    quantity: float = Field(default=1.0)
    amount: float
    base_amount: float = Field(default=0.0)
    tax_rate_id: Optional[int] = Field(default=None, foreign_key="taxrate.id")

    bill: Bill = Relationship(back_populates="lines")
