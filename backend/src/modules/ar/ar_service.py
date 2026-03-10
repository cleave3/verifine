from typing import Sequence, Optional
import uuid
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date
from sqlmodel import func, select, and_
from sqlalchemy.orm import selectinload

from src.utils.common import get_pagination_meta

from src.core.database import get_session
from src.models.customer import Customer
from src.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from src.models.account import Account
from src.models.tax import TaxRate
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.models.item import Item, ItemType
from src.modules.ar.ar_schema import CustomerCreate, CustomerUpdate, InvoiceCreate
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.core.errors import BadRequest
from src.core.audit import log_audit_event


class CustomerService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_customers(self, org_id: uuid.UUID) -> Sequence[Customer]:
        statement = (
            select(Customer).where(Customer.org_id == org_id).order_by(Customer.name)
        )
        results = await self.session.exec(statement)
        return results.all()

    async def get_customer_by_id(
        self, org_id: uuid.UUID, customer_id: int
    ) -> Optional[Customer]:
        statement = select(Customer).where(
            and_(Customer.id == customer_id, Customer.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_customer(
        self, org_id: uuid.UUID, customer_in: CustomerCreate, user_id: int
    ) -> Customer:
        db_customer = Customer(**customer_in.model_dump(), org_id=org_id)
        self.session.add(db_customer)
        await self.session.commit()
        await self.session.refresh(db_customer)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="CREATE_CUSTOMER",
            entity_type="Customer",
            entity_id=str(db_customer.id),
            previous_state=None,
            new_state=db_customer.model_dump(),
        )
        await self.session.commit()

        return db_customer

    async def update_customer(
        self,
        org_id: uuid.UUID,
        customer_id: int,
        customer_in: CustomerUpdate,
        user_id: int,
    ) -> Optional[Customer]:
        db_customer = await self.get_customer_by_id(org_id, customer_id)
        if not db_customer:
            return None

        prev_state = db_customer.model_dump()
        update_data = customer_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_customer, key, value)

        self.session.add(db_customer)
        await self.session.commit()
        await self.session.refresh(db_customer)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="UPDATE_CUSTOMER",
            entity_type="Customer",
            entity_id=str(db_customer.id),
            previous_state=prev_state,
            new_state=db_customer.model_dump(),
        )
        await self.session.commit()

        return db_customer


class InvoiceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_invoices(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 10,
        status: Optional[InvoiceStatus] = None,
        customer_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ):
        statement = (
            select(Invoice)
            .options(selectinload(Invoice.lines))
            .order_by(Invoice.invoice_date.desc(), Invoice.id.desc())
        )

        total_statement = select(func.count(Invoice.id)).where(Invoice.org_id == org_id)

        if status:
            statement = statement.where(Invoice.status == status)
            total_statement = total_statement.where(Invoice.status == status)

        if customer_id:
            statement = statement.where(Invoice.customer_id == customer_id)
            total_statement = total_statement.where(Invoice.customer_id == customer_id)

        if start_date:
            statement = statement.where(Invoice.invoice_date >= start_date)
            total_statement = total_statement.where(Invoice.invoice_date >= start_date)

        if end_date:
            statement = statement.where(Invoice.invoice_date <= end_date)
            total_statement = total_statement.where(Invoice.invoice_date <= end_date)

        statement = statement.offset((page - 1) * page_size).limit(page_size)

        results = await self.session.exec(statement)
        total_result = await self.session.exec(total_statement)
        total_records = total_result.first() or 0

        return {
            "results": results.all(),
            "meta": get_pagination_meta(page, page_size, total_records),
        }

    async def get_invoice_by_id(
        self, org_id: uuid.UUID, invoice_id: int
    ) -> Optional[Invoice]:
        statement = (
            select(Invoice)
            .where(and_(Invoice.id == invoice_id, Invoice.org_id == org_id))
            .options(selectinload(Invoice.lines))
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_invoice(
        self, org_id: uuid.UUID, invoice_in: InvoiceCreate, user_id: int
    ) -> Invoice:
        # Verify Customer
        customer_service = CustomerService(self.session)
        customer = await customer_service.get_customer_by_id(
            org_id, invoice_in.customer_id
        )
        if not customer:
            raise BadRequest("Invalid customer ID")

        tax_rates = {}
        for line in invoice_in.lines:
            if line.tax_rate_id and line.tax_rate_id not in tax_rates:
                stmt = select(TaxRate).where(
                    and_(TaxRate.id == line.tax_rate_id, TaxRate.org_id == org_id)
                )
                tr = (await self.session.exec(stmt)).first()
                if not tr:
                    raise BadRequest(f"Invalid tax rate ID {line.tax_rate_id}")
                tax_rates[line.tax_rate_id] = tr

        total_amount = 0.0
        for line in invoice_in.lines:
            line_amt = line.amount
            if line.tax_rate_id:
                tr = tax_rates[line.tax_rate_id]
                tax_amt = round(line_amt * float(tr.rate), 4)
                line_amt += tax_amt
            total_amount += line_amt

        base_total_amount = round(total_amount * invoice_in.exchange_rate, 4)

        db_invoice = Invoice(
            customer_id=invoice_in.customer_id,
            invoice_number=invoice_in.invoice_number,
            invoice_date=invoice_in.invoice_date,
            due_date=invoice_in.due_date,
            notes=invoice_in.notes,
            status=InvoiceStatus.DRAFT,
            currency_code=invoice_in.currency_code,
            exchange_rate=invoice_in.exchange_rate,
            total_amount=total_amount,
            base_total_amount=base_total_amount,
            org_id=org_id,
        )
        self.session.add(db_invoice)
        await self.session.flush()

        for line_in in invoice_in.lines:
            base_amount = (
                line_in.base_amount
                if line_in.base_amount is not None
                else round(line_in.amount * invoice_in.exchange_rate, 4)
            )
            db_line = InvoiceLineItem(
                invoice_id=db_invoice.id,
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

        full_invoice = await self.get_invoice_by_id(org_id, db_invoice.id)
        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="CREATE_INVOICE",
            entity_type="Invoice",
            entity_id=str(db_invoice.id),
            previous_state=None,
            new_state=full_invoice.model_dump(),
        )
        await self.session.commit()

        return full_invoice

    async def mark_sent(
        self, org_id: uuid.UUID, invoice_id: int, user_id: int
    ) -> Optional[Invoice]:
        db_invoice = await self.get_invoice_by_id(org_id, invoice_id)
        if not db_invoice:
            return None

        if db_invoice.status != InvoiceStatus.DRAFT:
            raise BadRequest(
                f"Cannot mark invoice as sent from status {db_invoice.status}"
            )

        prev_state = db_invoice.model_dump()
        db_invoice.status = InvoiceStatus.SENT
        self.session.add(db_invoice)
        await self.session.commit()

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="MARK_INVOICE_SENT",
            entity_type="Invoice",
            entity_id=str(db_invoice.id),
            previous_state=prev_state,
            new_state=db_invoice.model_dump(),
        )
        await self.session.commit()

        return db_invoice

    async def post_invoice(
        self, org_id: uuid.UUID, invoice_id: int, user_id: int
    ) -> Optional[Invoice]:
        db_invoice = await self.get_invoice_by_id(org_id, invoice_id)
        if not db_invoice:
            return None

        if db_invoice.status not in [InvoiceStatus.DRAFT, InvoiceStatus.SENT]:
            raise BadRequest(
                "Only DRAFT or SENT invoices can be posted to the general ledger."
            )

        # 1. Find AR Account (assumed to be 1200 - Accounts Receivable)
        stmt = select(Account).where(
            and_(Account.code == "1200", Account.org_id == org_id)
        )
        ar_act = (await self.session.exec(stmt)).first()
        if not ar_act:
            raise BadRequest("Accounts Receivable account (1200) not found.")

        # 2. Find Open Period
        stmt = select(FiscalPeriod).where(
            and_(
                FiscalPeriod.status == PeriodStatus.OPEN, FiscalPeriod.org_id == org_id
            )
        )
        period = (await self.session.exec(stmt)).first()
        if not period:
            raise BadRequest("No OPEN fiscal period found to post to.")

        # 3. Formulate Ledger Lines (Debit AR, Credit Revenue lines)
        ledger_lines = []

        # Debits AR
        ledger_lines.append(
            LedgerLineCreate(
                account_id=ar_act.id,
                currency_code=db_invoice.currency_code,
                exchange_rate=db_invoice.exchange_rate,
                transaction_debit=db_invoice.total_amount,
                transaction_credit=0.0,
                base_debit=db_invoice.base_total_amount,
                base_credit=0.0,
                description=f"Invoice Output - {db_invoice.invoice_number}",
            )
        )

        # Credits Revenue/Income accounts
        for line in db_invoice.lines:
            ledger_lines.append(
                LedgerLineCreate(
                    account_id=line.account_id,
                    currency_code=db_invoice.currency_code,
                    exchange_rate=db_invoice.exchange_rate,
                    transaction_debit=0.0,
                    transaction_credit=line.amount,
                    base_debit=0.0,
                    base_credit=line.base_amount,
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
                            currency_code=db_invoice.currency_code,
                            exchange_rate=db_invoice.exchange_rate,
                            transaction_debit=0.0,
                            transaction_credit=tax_amt,
                            base_debit=0.0,
                            base_credit=base_tax_amt,
                            description=f"Tax for {line.description}",
                        )
                    )

            # COGS logic for inventory items
            if line.item_id:
                stmt_item = select(Item).where(Item.id == line.item_id)
                item = (await self.session.exec(stmt_item)).first()
                if (
                    item
                    and item.type == ItemType.INVENTORY
                    and item.cogs_account_id
                    and item.asset_account_id
                ):
                    cogs_amt = item.unit_cost * line.quantity
                    base_cogs_amt = round(cogs_amt * db_invoice.exchange_rate, 4)

                    if cogs_amt > 0:
                        # Debit COGS
                        ledger_lines.append(
                            LedgerLineCreate(
                                account_id=item.cogs_account_id,
                                currency_code=db_invoice.currency_code,
                                exchange_rate=db_invoice.exchange_rate,
                                transaction_debit=cogs_amt,
                                transaction_credit=0.0,
                                base_debit=base_cogs_amt,
                                base_credit=0.0,
                                description=f"COGS for {item.name}",
                            )
                        )
                        # Credit Inventory Asset
                        ledger_lines.append(
                            LedgerLineCreate(
                                account_id=item.asset_account_id,
                                currency_code=db_invoice.currency_code,
                                exchange_rate=db_invoice.exchange_rate,
                                transaction_debit=0.0,
                                transaction_credit=cogs_amt,
                                base_debit=0.0,
                                base_credit=base_cogs_amt,
                                description=f"Inventory Decrease for {item.name}",
                            )
                        )

        # 4. Generate Journal Entry
        je_create = JournalEntryCreate(
            description=f"Automated Entry for Invoice {db_invoice.invoice_number}",
            entry_date=db_invoice.invoice_date,
            period_id=period.id,
            lines=ledger_lines,
        )

        je_service = JournalEntryService(self.session)
        je = await je_service.create_journal_entry(org_id, je_create, user_id)

        # 5. Link and Update Invoice Status
        prev_state = db_invoice.model_dump()
        db_invoice.journal_entry_id = je.id
        db_invoice.status = InvoiceStatus.POSTED
        self.session.add(db_invoice)
        await self.session.commit()

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="POST_INVOICE",
            entity_type="Invoice",
            entity_id=str(db_invoice.id),
            previous_state=prev_state,
            new_state=db_invoice.model_dump(),
        )
        await self.session.commit()

        return db_invoice

    async def mark_paid(
        self, org_id: uuid.UUID, invoice_id: int, user_id: int
    ) -> Optional[Invoice]:
        db_invoice = await self.get_invoice_by_id(org_id, invoice_id)
        if not db_invoice:
            return None

        if db_invoice.status != InvoiceStatus.POSTED:
            raise BadRequest(
                f"Cannot mark invoice as paid from status {db_invoice.status}. Only POSTED invoices can be paid."
            )

        prev_state = db_invoice.model_dump()
        db_invoice.status = InvoiceStatus.PAID
        self.session.add(db_invoice)
        await self.session.commit()

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="PAY_INVOICE",
            entity_type="Invoice",
            entity_id=str(db_invoice.id),
            previous_state=prev_state,
            new_state=db_invoice.model_dump(),
        )
        await self.session.commit()

        return db_invoice


def get_customer_service(
    session: AsyncSession = Depends(get_session),
) -> CustomerService:
    return CustomerService(session=session)


def get_invoice_service(session: AsyncSession = Depends(get_session)) -> InvoiceService:
    return InvoiceService(session=session)
