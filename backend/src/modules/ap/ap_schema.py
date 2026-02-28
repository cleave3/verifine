from typing import Optional, List
from datetime import date
from pydantic import BaseModel
from src.models.vendor import VendorStatus
from src.models.bill import BillStatus


class VendorBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: VendorStatus = VendorStatus.ACTIVE
    default_expense_account_id: Optional[int] = None


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: Optional[VendorStatus] = None
    default_expense_account_id: Optional[int] = None


class VendorRead(VendorBase):
    id: int


class BillLineItemBase(BaseModel):
    account_id: int
    description: str
    amount: float


class BillLineItemCreate(BillLineItemBase):
    pass


class BillLineItemRead(BillLineItemBase):
    id: int
    bill_id: int


class BillBase(BaseModel):
    vendor_id: int
    bill_number: str
    bill_date: date
    due_date: date
    notes: Optional[str] = None


class BillCreate(BillBase):
    lines: List[BillLineItemCreate]


class BillUpdate(BaseModel):
    bill_number: Optional[str] = None
    bill_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class BillRead(BillBase):
    id: int
    status: BillStatus
    total_amount: float
    journal_entry_id: Optional[int] = None
    lines: List[BillLineItemRead]
