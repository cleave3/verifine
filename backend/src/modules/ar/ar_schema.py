from typing import Optional, List
from datetime import date
from pydantic import BaseModel
from src.models.customer import CustomerStatus
from src.models.invoice import InvoiceStatus


class CustomerBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: CustomerStatus = CustomerStatus.ACTIVE
    default_revenue_account_id: Optional[int] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: Optional[CustomerStatus] = None
    default_revenue_account_id: Optional[int] = None


class CustomerRead(CustomerBase):
    id: int


class InvoiceLineItemBase(BaseModel):
    account_id: int
    description: str
    amount: float
    base_amount: Optional[float] = None


class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass


class InvoiceLineItemRead(InvoiceLineItemBase):
    id: int
    invoice_id: int


class InvoiceBase(BaseModel):
    customer_id: int
    invoice_number: str
    invoice_date: date
    due_date: date
    notes: Optional[str] = None
    currency_code: str = "NGN"
    exchange_rate: float = 1.0


class InvoiceCreate(InvoiceBase):
    lines: List[InvoiceLineItemCreate]


class InvoiceRead(InvoiceBase):
    id: int
    status: InvoiceStatus
    total_amount: float
    base_total_amount: float
    journal_entry_id: Optional[int] = None
    lines: List[InvoiceLineItemRead]
