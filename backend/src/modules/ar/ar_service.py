from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date
from sqlmodel import func, select
from sqlalchemy.orm import selectinload

from src.utils.common import get_pagination_meta

from src.core.database import get_session
from src.models.customer import Customer
from src.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from src.models.account import Account
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.modules.ar.ar_schema import CustomerCreate, CustomerUpdate, InvoiceCreate
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.core.errors import BadRequest


class CustomerService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_customers(self) -> Sequence[Customer]:
        statement = select(Customer).order_by(Customer.name)
        results = await self.session.exec(statement)
        return results.all()

    async def get_customer_by_id(self, customer_id: int) -> Optional[Customer]:
        return await self.session.get(Customer, customer_id)

    async def create_customer(self, customer_in: CustomerCreate) -> Customer:
        db_customer = Customer(**customer_in.model_dump())
        self.session.add(db_customer)
        await self.session.commit()
        await self.session.refresh(db_customer)
        return db_customer

    async def update_customer(
        self, customer_id: int, customer_in: CustomerUpdate
    ) -> Optional[Customer]:
        db_customer = await self.get_customer_by_id(customer_id)
        if not db_customer:
            return None

        update_data = customer_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_customer, key, value)

        self.session.add(db_customer)
        await self.session.commit()
        await self.session.refresh(db_customer)
        return db_customer


class InvoiceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_invoices(
        self,
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

        total_statement = select(func.count(Invoice.id))

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

    async def get_invoice_by_id(self, invoice_id: int) -> Optional[Invoice]:
        statement = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.lines))
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_invoice(self, invoice_in: InvoiceCreate) -> Invoice:
        # Verify Customer
        customer = await self.session.get(Customer, invoice_in.customer_id)
        if not customer:
            raise BadRequest("Invalid customer ID")

        total_amount = sum(line.amount for line in invoice_in.lines)
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
                account_id=line_in.account_id,
                description=line_in.description,
                amount=line_in.amount,
                base_amount=base_amount,
            )
            self.session.add(db_line)

        await self.session.commit()
        return await self.get_invoice_by_id(db_invoice.id)

    async def mark_sent(self, invoice_id: int) -> Optional[Invoice]:
        db_invoice = await self.get_invoice_by_id(invoice_id)
        if not db_invoice:
            return None

        if db_invoice.status != InvoiceStatus.DRAFT:
            raise BadRequest(
                f"Cannot mark invoice as sent from status {db_invoice.status}"
            )

        db_invoice.status = InvoiceStatus.SENT
        self.session.add(db_invoice)
        await self.session.commit()
        return db_invoice

    async def post_invoice(self, invoice_id: int, user_id: int) -> Optional[Invoice]:
        db_invoice = await self.get_invoice_by_id(invoice_id)
        if not db_invoice:
            return None

        if db_invoice.status not in [InvoiceStatus.DRAFT, InvoiceStatus.SENT]:
            raise BadRequest(
                "Only DRAFT or SENT invoices can be posted to the general ledger."
            )

        # 1. Find AR Account (assumed to be 1200 - Accounts Receivable)
        stmt = select(Account).where(Account.code == "1200")
        ar_act = (await self.session.exec(stmt)).first()
        if not ar_act:
            raise BadRequest("Accounts Receivable account (1200) not found.")

        # 2. Find Open Period
        stmt = select(FiscalPeriod).where(FiscalPeriod.status == PeriodStatus.OPEN)
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

        # 4. Generate Journal Entry
        je_create = JournalEntryCreate(
            description=f"Automated Entry for Invoice {db_invoice.invoice_number}",
            entry_date=db_invoice.invoice_date,
            period_id=period.id,
            lines=ledger_lines,
        )

        je_service = JournalEntryService(self.session)
        je = await je_service.create_journal_entry(je_create, user_id)

        # 5. Link and Update Invoice Status
        db_invoice.journal_entry_id = je.id
        db_invoice.status = InvoiceStatus.POSTED
        self.session.add(db_invoice)
        await self.session.commit()

        return db_invoice

    async def mark_paid(self, invoice_id: int) -> Optional[Invoice]:
        db_invoice = await self.get_invoice_by_id(invoice_id)
        if not db_invoice:
            return None

        if db_invoice.status != InvoiceStatus.POSTED:
            raise BadRequest(
                f"Cannot mark invoice as paid from status {db_invoice.status}. Only POSTED invoices can be paid."
            )

        db_invoice.status = InvoiceStatus.PAID
        self.session.add(db_invoice)
        await self.session.commit()
        return db_invoice


def get_customer_service(
    session: AsyncSession = Depends(get_session),
) -> CustomerService:
    return CustomerService(session=session)


def get_invoice_service(session: AsyncSession = Depends(get_session)) -> InvoiceService:
    return InvoiceService(session=session)
