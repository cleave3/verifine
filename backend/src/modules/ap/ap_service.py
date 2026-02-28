from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from src.core.database import get_session
from src.models.vendor import Vendor
from src.models.bill import Bill, BillLineItem, BillStatus
from src.models.account import Account
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.modules.ap.ap_schema import VendorCreate, VendorUpdate, BillCreate, BillUpdate
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.core.errors import BadRequest


class VendorService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_vendors(self) -> Sequence[Vendor]:
        statement = select(Vendor).order_by(Vendor.name)
        results = await self.session.exec(statement)
        return results.all()

    async def get_vendor_by_id(self, vendor_id: int) -> Optional[Vendor]:
        return await self.session.get(Vendor, vendor_id)

    async def create_vendor(self, vendor_in: VendorCreate) -> Vendor:
        db_vendor = Vendor(**vendor_in.model_dump())
        self.session.add(db_vendor)
        await self.session.commit()
        await self.session.refresh(db_vendor)
        return db_vendor

    async def update_vendor(
        self, vendor_id: int, vendor_in: VendorUpdate
    ) -> Optional[Vendor]:
        db_vendor = await self.get_vendor_by_id(vendor_id)
        if not db_vendor:
            return None

        update_data = vendor_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_vendor, key, value)

        self.session.add(db_vendor)
        await self.session.commit()
        await self.session.refresh(db_vendor)
        return db_vendor


class BillService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_bills(self) -> Sequence[Bill]:
        statement = (
            select(Bill)
            .options(selectinload(Bill.lines))
            .order_by(Bill.bill_date.desc())
        )
        results = await self.session.exec(statement)
        return results.all()

    async def get_bill_by_id(self, bill_id: int) -> Optional[Bill]:
        statement = (
            select(Bill).where(Bill.id == bill_id).options(selectinload(Bill.lines))
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_bill(self, bill_in: BillCreate) -> Bill:
        # Verify Vendor
        vendor = await self.session.get(Vendor, bill_in.vendor_id)
        if not vendor:
            raise BadRequest("Invalid vendor ID")

        # Sum total
        total_amount = sum(line.amount for line in bill_in.lines)

        db_bill = Bill(
            vendor_id=bill_in.vendor_id,
            bill_number=bill_in.bill_number,
            bill_date=bill_in.bill_date,
            due_date=bill_in.due_date,
            notes=bill_in.notes,
            status=BillStatus.DRAFT,
            total_amount=total_amount,
        )
        self.session.add(db_bill)
        await self.session.flush()

        for line_in in bill_in.lines:
            db_line = BillLineItem(
                bill_id=db_bill.id,
                account_id=line_in.account_id,
                description=line_in.description,
                amount=line_in.amount,
            )
            self.session.add(db_line)

        await self.session.commit()
        return await self.get_bill_by_id(db_bill.id)

    async def approve_bill(self, bill_id: int) -> Optional[Bill]:
        db_bill = await self.get_bill_by_id(bill_id)
        if not db_bill:
            return None

        if db_bill.status != BillStatus.DRAFT:
            raise BadRequest(f"Cannot approve bill with status {db_bill.status}")

        db_bill.status = BillStatus.APPROVED
        self.session.add(db_bill)
        await self.session.commit()
        return db_bill

    async def post_bill(self, bill_id: int, user_id: int) -> Optional[Bill]:
        db_bill = await self.get_bill_by_id(bill_id)
        if not db_bill:
            return None

        if db_bill.status != BillStatus.APPROVED:
            raise BadRequest("Only APPROVED bills can be posted to the general ledger.")

        # 1. Find AP Account
        stmt = select(Account).where(Account.code == "2000")
        ap_act = (await self.session.exec(stmt)).first()
        if not ap_act:
            raise BadRequest("Accounts Payable account (2000) not found.")

        # 2. Find Open Period
        stmt = select(FiscalPeriod).where(FiscalPeriod.status == PeriodStatus.OPEN)
        period = (await self.session.exec(stmt)).first()
        if not period:
            raise BadRequest("No OPEN fiscal period found to post to.")

        # 3. Formulate Ledger Lines (Debit lines, Credit AP)
        ledger_lines = []
        for line in db_bill.lines:
            ledger_lines.append(
                LedgerLineCreate(
                    account_id=line.account_id,
                    debit=line.amount,
                    credit=0.0,
                    description=line.description,
                )
            )

        ledger_lines.append(
            LedgerLineCreate(
                account_id=ap_act.id,
                debit=0.0,
                credit=db_bill.total_amount,
                description=f"Bill Output - {db_bill.bill_number}",
            )
        )

        # 4. Generate Journal Entry
        je_create = JournalEntryCreate(
            description=f"Automated Entry for Bill {db_bill.bill_number}",
            entry_date=db_bill.bill_date,
            period_id=period.id,
            lines=ledger_lines,
        )

        je_service = JournalEntryService(self.session)
        je = await je_service.create_journal_entry(je_create, user_id)

        # 5. Link and Update Bill Status
        db_bill.journal_entry_id = je.id
        db_bill.status = BillStatus.POSTED
        self.session.add(db_bill)
        await self.session.commit()

        return db_bill

    async def mark_paid(self, bill_id: int) -> Optional[Bill]:
        db_bill = await self.get_bill_by_id(bill_id)
        if not db_bill:
            return None

        if db_bill.status != BillStatus.POSTED:
            raise BadRequest(
                f"Cannot mark bill as paid from status {db_bill.status}. Only POSTED bills can be paid."
            )

        db_bill.status = BillStatus.PAID
        self.session.add(db_bill)
        await self.session.commit()
        return db_bill


def get_vendor_service(session: AsyncSession = Depends(get_session)) -> VendorService:
    return VendorService(session=session)


def get_bill_service(session: AsyncSession = Depends(get_session)) -> BillService:
    return BillService(session=session)
