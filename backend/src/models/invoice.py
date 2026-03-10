from typing import Optional, List
import uuid
from typing import Optional, List
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from enum import Enum


class InvoiceStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    POSTED = "POSTED"
    PAID = "PAID"
    VOID = "VOID"


class Invoice(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("org_id", "invoice_number"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    customer_id: int = Field(foreign_key="customer.id")
    invoice_number: str = Field(index=True)
    invoice_date: date
    due_date: date
    status: InvoiceStatus = Field(default=InvoiceStatus.DRAFT)

    currency_code: str = Field(default="NGN")
    exchange_rate: float = Field(default=1.0)
    total_amount: float = Field(default=0.0)
    base_total_amount: float = Field(default=0.0)
    notes: Optional[str] = None

    # Link to the generated Journal Entry once posted
    journal_entry_id: Optional[int] = Field(default=None, foreign_key="journalentry.id")

    customer: "Customer" = Relationship(back_populates="invoices")
    lines: List["InvoiceLineItem"] = Relationship(back_populates="invoice")


class InvoiceLineItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id")
    invoice_id: int = Field(foreign_key="invoice.id")
    item_id: Optional[int] = Field(default=None, foreign_key="item.id")
    account_id: int = Field(foreign_key="account.id")  # Revenue account
    description: str
    quantity: float = Field(default=1.0)
    amount: float
    base_amount: float = Field(default=0.0)
    tax_rate_id: Optional[int] = Field(default=None, foreign_key="taxrate.id")

    invoice: Invoice = Relationship(back_populates="lines")
