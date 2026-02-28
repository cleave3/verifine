import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date, timedelta
from sqlmodel import SQLModel

from src.core.database import engine
from src.core.security import get_password_hash
from src.models.user import User
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
from src.models.account import Account, AccountType
from src.models.vendor import Vendor
from src.models.customer import Customer
from src.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from src.models.bill import Bill, BillLineItem, BillStatus


async def seed_data():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(SQLModel.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(SQLModel.metadata.create_all)

    async with AsyncSession(engine, expire_on_commit=False) as session:
        print("Seeding Users...")
        admin = User(
            email="admin@verifine.com",
            full_name="Verifine Admin",
            hashed_password=get_password_hash("verifineadmin2026"),
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()
        await session.refresh(admin)

        print("Seeding Periods...")
        periods = []
        today = date.today()
        # Seed last 6 months + current
        for i in range(6, -1, -1):
            start = (today.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            p = FiscalPeriod(
                name=start.strftime("%B %Y"),
                start_date=start,
                end_date=end,
                status=PeriodStatus.OPEN if i == 0 else PeriodStatus.CLOSED,
            )
            session.add(p)
            periods.append(p)
        await session.commit()
        for p in periods:
            await session.refresh(p)

        print("Seeding Accounts...")
        accounts = {
            "cash": Account(code="1000", name="Operating Cash", type=AccountType.ASSET),
            "ar": Account(
                code="1200", name="Accounts Receivable", type=AccountType.ASSET
            ),
            "ap": Account(
                code="2000", name="Accounts Payable", type=AccountType.LIABILITY
            ),
            "revenue": Account(
                code="4000", name="Service Revenue", type=AccountType.REVENUE
            ),
            "sw": Account(
                code="5000", name="Software Expenses", type=AccountType.EXPENSE
            ),
            "rent": Account(code="5100", name="Rent", type=AccountType.EXPENSE),
            "payroll": Account(code="5200", name="Payroll", type=AccountType.EXPENSE),
        }
        for acc in accounts.values():
            session.add(acc)
        await session.commit()
        for acc in accounts.values():
            await session.refresh(acc)

        print("Seeding Vendors & Customers...")
        v1 = Vendor(name="AWS Inc", email="billing@aws.com", payment_terms_days=30)
        v2 = Vendor(name="WeWork", email="rent@wework.com", payment_terms_days=15)
        c1 = Customer(name="Acme Corp", email="ap@acme.com", payment_terms_days=30)
        c2 = Customer(
            name="Global Tech", email="finance@global.com", payment_terms_days=45
        )
        session.add_all([v1, v2, c1, c2])
        await session.commit()
        await session.refresh(v1)
        await session.refresh(c1)

        print("Seeding Invoices and Bills...")
        # Create an invoice
        inv = Invoice(
            customer_id=c1.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            invoice_number="INV-001",
            total_amount=5000.0,
            status=InvoiceStatus.SENT,
        )
        session.add(inv)
        await session.commit()
        await session.refresh(inv)

        inv_line = InvoiceLineItem(
            invoice_id=inv.id,
            account_id=accounts["revenue"].id,
            amount=5000.0,
            description="Consulting Services",
        )
        session.add(inv_line)

        # Create a bill
        bill = Bill(
            vendor_id=v1.id,
            bill_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            bill_number="AWS-2026-02",
            total_amount=1500.0,
            status=BillStatus.APPROVED,
        )
        session.add(bill)
        await session.commit()
        await session.refresh(bill)

        bill_line = BillLineItem(
            bill_id=bill.id,
            account_id=accounts["sw"].id,
            amount=1500.0,
            description="Cloud Hosting",
        )
        session.add(bill_line)

        await session.commit()
        print("Database seeding completed.")


if __name__ == "__main__":
    asyncio.run(seed_data())
