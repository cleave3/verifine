from typing import Sequence, Optional
import uuid
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date
from sqlmodel import func, select, and_
from sqlalchemy.orm import selectinload

from src.utils.common import get_pagination_meta

from src.core.database import get_session
from src.models.vendor import Vendor
from src.models.bill import Bill, BillLineItem, BillStatus
from src.models.account import Account
from src.models.tax import TaxRate
from src.models.organization import Organization
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.models.item import Item, ItemType
from src.modules.ap.ap_schema import VendorCreate, VendorUpdate, BillCreate, BillUpdate
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.core.errors import BadRequest
from src.core.audit import log_audit_event


class VendorService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_vendors(self, org_id: uuid.UUID) -> Sequence[Vendor]:
        statement = select(Vendor).where(Vendor.org_id == org_id).order_by(Vendor.name)
        results = await self.session.exec(statement)
        return results.all()

    async def get_vendor_by_id(
        self, org_id: uuid.UUID, vendor_id: int
    ) -> Optional[Vendor]:
        statement = select(Vendor).where(
            and_(Vendor.id == vendor_id, Vendor.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_vendor(
        self, org_id: uuid.UUID, vendor_in: VendorCreate, user_id: int
    ) -> Vendor:
        db_vendor = Vendor(**vendor_in.model_dump(), org_id=org_id)
        self.session.add(db_vendor)
        await self.session.commit()
        await self.session.refresh(db_vendor)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="CREATE_VENDOR",
            entity_type="Vendor",
            entity_id=str(db_vendor.id),
            previous_state=None,
            new_state=db_vendor.model_dump(),
        )
        await self.session.commit()

        return db_vendor

    async def update_vendor(
        self, org_id: uuid.UUID, vendor_id: int, vendor_in: VendorUpdate, user_id: int
    ) -> Optional[Vendor]:
        db_vendor = await self.get_vendor_by_id(org_id, vendor_id)
        if not db_vendor:
            return None

        prev_state = db_vendor.model_dump()
        update_data = vendor_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_vendor, key, value)

        self.session.add(db_vendor)
        await self.session.commit()
        await self.session.refresh(db_vendor)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="UPDATE_VENDOR",
            entity_type="Vendor",
            entity_id=str(db_vendor.id),
            previous_state=prev_state,
            new_state=db_vendor.model_dump(),
        )
        await self.session.commit()

        return db_vendor


class BillService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_bills(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 10,
        status: Optional[BillStatus] = None,
        vendor_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ):
        statement = (
            select(Bill)
            .options(selectinload(Bill.lines))
            .order_by(Bill.bill_date.desc(), Bill.id.desc())
        )

        total_statement = select(func.count(Bill.id)).where(Bill.org_id == org_id)

        if status:
            statement = statement.where(Bill.status == status)
            total_statement = total_statement.where(Bill.status == status)

        if vendor_id:
            statement = statement.where(Bill.vendor_id == vendor_id)
            total_statement = total_statement.where(Bill.vendor_id == vendor_id)

        if start_date:
            statement = statement.where(Bill.bill_date >= start_date)
            total_statement = total_statement.where(Bill.bill_date >= start_date)

        if end_date:
            statement = statement.where(Bill.bill_date <= end_date)
            total_statement = total_statement.where(Bill.bill_date <= end_date)

        statement = statement.offset((page - 1) * page_size).limit(page_size)

        results = await self.session.exec(statement)
        total_result = await self.session.exec(total_statement)
        total_records = total_result.first() or 0

        return {
            "results": results.all(),
            "meta": get_pagination_meta(page, page_size, total_records),
        }

    async def get_bill_by_id(self, org_id: uuid.UUID, bill_id: int) -> Optional[Bill]:
        statement = (
            select(Bill)
            .where(and_(Bill.id == bill_id, Bill.org_id == org_id))
            .options(selectinload(Bill.lines))
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_bill(
        self, org_id: uuid.UUID, bill_in: BillCreate, user_id: int
    ) -> Bill:
        # Verify Vendor
        vendor_service = VendorService(self.session)
        vendor = await vendor_service.get_vendor_by_id(org_id, bill_in.vendor_id)
        if not vendor:
            raise BadRequest("Invalid vendor ID")

        tax_rates = {}
        for line in bill_in.lines:
            if line.tax_rate_id and line.tax_rate_id not in tax_rates:
                stmt = select(TaxRate).where(
                    and_(TaxRate.id == line.tax_rate_id, TaxRate.org_id == org_id)
                )
                tr = (await self.session.exec(stmt)).first()
                if not tr:
                    raise BadRequest(f"Invalid tax rate ID {line.tax_rate_id}")
                tax_rates[line.tax_rate_id] = tr

        total_amount = 0.0
        for line in bill_in.lines:
            line_amt = line.amount
            if line.tax_rate_id:
                tr = tax_rates[line.tax_rate_id]
                tax_amt = round(line_amt * float(tr.rate), 4)
                line_amt += tax_amt
            total_amount += line_amt

        base_total_amount = round(total_amount * bill_in.exchange_rate, 4)

        db_bill = Bill(
            vendor_id=bill_in.vendor_id,
            bill_number=bill_in.bill_number,
            bill_date=bill_in.bill_date,
            due_date=bill_in.due_date,
            notes=bill_in.notes,
            status=BillStatus.DRAFT,
            currency_code=bill_in.currency_code,
            exchange_rate=bill_in.exchange_rate,
            total_amount=total_amount,
            base_total_amount=base_total_amount,
            org_id=org_id,
        )
        self.session.add(db_bill)
        await self.session.flush()

        for line_in in bill_in.lines:
            base_amount = (
                line_in.base_amount
                if line_in.base_amount is not None
                else round(line_in.amount * bill_in.exchange_rate, 4)
            )
            db_line = BillLineItem(
                bill_id=db_bill.id,
                item_id=line_in.item_id,
                account_id=line_in.account_id,
                description=line_in.description,
                quantity=line_in.quantity if hasattr(line_in, "quantity") else 1.0,
                amount=line_in.amount,
                base_amount=base_amount,
                tax_rate_id=line_in.tax_rate_id,
                org_id=org_id,
            )
            self.session.add(db_line)

        await self.session.commit()

        full_bill = await self.get_bill_by_id(org_id, db_bill.id)
        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="CREATE_BILL",
            entity_type="Bill",
            entity_id=str(db_bill.id),
            previous_state=None,
            new_state=full_bill.model_dump(),
        )
        await self.session.commit()

        return full_bill

    async def approve_bill(
        self, org_id: uuid.UUID, bill_id: int, user_id: int
    ) -> Optional[Bill]:
        db_bill = await self.get_bill_by_id(org_id, bill_id)
        if not db_bill:
            return None

        if db_bill.status != BillStatus.DRAFT:
            raise BadRequest(f"Cannot approve bill with status {db_bill.status}")

        prev_state = db_bill.model_dump()
        db_bill.status = BillStatus.APPROVED
        self.session.add(db_bill)
        await self.session.commit()

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="APPROVE_BILL",
            entity_type="Bill",
            entity_id=str(db_bill.id),
            previous_state=prev_state,
            new_state=db_bill.model_dump(),
        )
        await self.session.commit()

        return db_bill

    async def post_bill(
        self, org_id: uuid.UUID, bill_id: int, user_id: int
    ) -> Optional[Bill]:
        db_bill = await self.get_bill_by_id(org_id, bill_id)
        if not db_bill:
            return None

        if db_bill.status != BillStatus.APPROVED:
            raise BadRequest("Only APPROVED bills can be posted to the general ledger.")

        # Get Organization for Tax Regime
        stmt_org = select(Organization).where(Organization.id == org_id)
        org = (await self.session.exec(stmt_org)).first()
        if not org:
            raise BadRequest("Organization not found")

        # 1. Find AP Account
        stmt = select(Account).where(
            and_(Account.code == "2000", Account.org_id == org_id)
        )
        ap_act = (await self.session.exec(stmt)).first()
        if not ap_act:
            raise BadRequest("Accounts Payable account (2000) not found.")

        # 2. Find Open Period
        stmt = select(FiscalPeriod).where(
            and_(
                FiscalPeriod.status == PeriodStatus.OPEN, FiscalPeriod.org_id == org_id
            )
        )
        period = (await self.session.exec(stmt)).first()
        if not period:
            raise BadRequest("No OPEN fiscal period found to post to.")

        # 3. Formulate Ledger Lines (Debit lines, Credit AP)
        ledger_lines = []
        for line in db_bill.lines:
            ledger_lines.append(
                LedgerLineCreate(
                    account_id=line.account_id,
                    currency_code=db_bill.currency_code,
                    exchange_rate=db_bill.exchange_rate,
                    transaction_debit=line.amount,
                    transaction_credit=0.0,
                    base_debit=line.base_amount,
                    base_credit=0.0,
                    description=line.description,
                )
            )
            if line.tax_rate_id:
                stmt = select(TaxRate).where(TaxRate.id == line.tax_rate_id)
                tr = (await self.session.exec(stmt)).first()
                if tr:
                    tax_amt = round(line.amount * float(tr.rate), 4)
                    base_tax_amt = round(line.base_amount * float(tr.rate), 4)
                    ledger_lines.append(
                        LedgerLineCreate(
                            account_id=tr.account_id,
                            currency_code=db_bill.currency_code,
                            exchange_rate=db_bill.exchange_rate,
                            transaction_debit=tax_amt,
                            transaction_credit=0.0,
                            base_debit=base_tax_amt,
                            base_credit=0.0,
                            description=f"Tax for {line.description}",
                        )
                    )

            # If it's an inventory item, optionally we could override the account_id
            # However, routing to Inventory Asset account should be verified here.
            # If the user selected an Expense account but the item is INVENTORY,
            # we force it to Item.asset_account_id if we want automated valuation,
            # OR we just rely on the frontend sending asset_account_id.
            # To be safe, we override if item is INVENTORY
            if line.item_id:
                stmt_item = select(Item).where(Item.id == line.item_id)
                item = (await self.session.exec(stmt_item)).first()
                if item and item.type == ItemType.INVENTORY and item.asset_account_id:
                    # Update the line to use the asset account
                    ledger_lines[-1].account_id = item.asset_account_id
                    ledger_lines[-1].description = (
                        f"Inventory Asset Purchase: {item.name}"
                    )

        # Calculate WHT for Nigeria Regime
        total_wht = 0.0
        base_total_wht = 0.0
        if org.tax_regime == "NIGERIA_NTA_2026":
            # For each line, if it's a service, deduct WHT (simplified to 5% if individual, 10% if corp)
            # For simplicity, we'll check if any tax rate is marked as WHT or if we're in Nigeria mode
            # We'll use a placeholder account 2110 for WHT Payable if found
            stmt_wht = select(Account).where(and_(Account.code == "2110", Account.org_id == org_id))
            wht_payable_act = (await self.session.exec(stmt_wht)).first()
            
            if wht_payable_act:
                for line in db_bill.lines:
                    # In a real app, we'd check item type or vendor type
                    # Here we sum it up
                    # Placeholder: 5% WHT on net amount for all lines if Nigeria mode
                    line_wht = round(line.amount * 0.05, 4)
                    base_line_wht = round(line.base_amount * 0.05, 4)
                    total_wht += line_wht
                    base_total_wht += base_line_wht
                
                if total_wht > 0:
                    ledger_lines.append(
                        LedgerLineCreate(
                            account_id=wht_payable_act.id,
                            currency_code=db_bill.currency_code,
                            exchange_rate=db_bill.exchange_rate,
                            transaction_debit=0.0,
                            transaction_credit=total_wht,
                            base_debit=0.0,
                            base_credit=base_total_wht,
                            description=f"WHT Deduction - {db_bill.bill_number}",
                        )
                    )

        ledger_lines.append(
            LedgerLineCreate(
                account_id=ap_act.id,
                currency_code=db_bill.currency_code,
                exchange_rate=db_bill.exchange_rate,
                transaction_debit=0.0,
                transaction_credit=db_bill.total_amount - total_wht,
                base_debit=0.0,
                base_credit=db_bill.base_total_amount - base_total_wht,
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
        je = await je_service.create_journal_entry(org_id, je_create, user_id)

        prev_state = db_bill.model_dump()
        db_bill.journal_entry_id = je.id
        db_bill.status = BillStatus.POSTED
        self.session.add(db_bill)
        await self.session.commit()

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="POST_BILL",
            entity_type="Bill",
            entity_id=str(db_bill.id),
            previous_state=prev_state,
            new_state=db_bill.model_dump(),
        )
        await self.session.commit()

        return db_bill

    async def mark_paid(
        self, org_id: uuid.UUID, bill_id: int, user_id: int
    ) -> Optional[Bill]:
        db_bill = await self.get_bill_by_id(org_id, bill_id)
        if not db_bill:
            return None

        if db_bill.status != BillStatus.POSTED:
            raise BadRequest(
                f"Cannot mark bill as paid from status {db_bill.status}. Only POSTED bills can be paid."
            )

        prev_state = db_bill.model_dump()
        db_bill.status = BillStatus.PAID
        self.session.add(db_bill)
        await self.session.commit()

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="PAY_BILL",
            entity_type="Bill",
            entity_id=str(db_bill.id),
            previous_state=prev_state,
            new_state=db_bill.model_dump(),
        )
        await self.session.commit()
        return db_bill


def get_vendor_service(session: AsyncSession = Depends(get_session)) -> VendorService:
    return VendorService(session=session)


def get_bill_service(session: AsyncSession = Depends(get_session)) -> BillService:
    return BillService(session=session)
