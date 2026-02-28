from typing import Optional, List
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
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id")
    invoice_number: str = Field(index=True, unique=True)
    invoice_date: date
    due_date: date
    status: InvoiceStatus = Field(default=InvoiceStatus.DRAFT)
    total_amount: float = Field(default=0.0)
    notes: Optional[str] = None

    # Link to the generated Journal Entry once posted
    journal_entry_id: Optional[int] = Field(default=None, foreign_key="journalentry.id")

    customer: "Customer" = Relationship(back_populates="invoices")
    lines: List["InvoiceLineItem"] = Relationship(back_populates="invoice")


class InvoiceLineItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoice.id")
    account_id: int = Field(foreign_key="account.id")  # Revenue account
    description: str
    amount: float

    invoice: Invoice = Relationship(back_populates="lines")
