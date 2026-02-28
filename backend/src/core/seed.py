import asyncio
import logging
from datetime import date, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import engine
from src.modules.auth.auth_service import AuthService
from src.modules.auth.auth_schema import UserCreate
from src.modules.account.account_service import AccountService
from src.modules.account.account_schema import AccountCreate
from src.models.account import AccountType
from src.modules.fiscal_period.fiscal_period_service import FiscalPeriodService
from src.modules.fiscal_period.fiscal_period_schema import FiscalPeriodCreate
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
from src.modules.ap.ap_service import VendorService
from src.modules.ap.ap_schema import VendorCreate
from src.modules.ar.ar_service import CustomerService
from src.modules.ar.ar_schema import CustomerCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_db():
    logger.info("Starting database seeding...")
    async with AsyncSession(engine, expire_on_commit=False) as session:
        auth_service = AuthService(session)
        account_service = AccountService(session)
        period_service = FiscalPeriodService(session)
        je_service = JournalEntryService(session)
        vendor_service = VendorService(session)
        customer_service = CustomerService(session)

        # 1. Seed Admin User
        admin_email = "admin@verifine.com"
        admin = await auth_service.get_user_by_email(admin_email)
        if not admin:
            logger.info("Creating admin user...")
            admin = await auth_service.create_user(
                UserCreate(
                    email=admin_email, password="password123", full_name="System Admin"
                )
            )
        else:
            logger.info("Admin user already exists.")

        # 2. Seed Chart of Accounts
        existing_accounts = await account_service.get_accounts()
        if not existing_accounts:
            logger.info("Creating standard Chart of Accounts...")
            accounts_to_create = [
                AccountCreate(
                    code="1000", name="Operating Cash", type=AccountType.ASSET
                ),
                AccountCreate(
                    code="1200", name="Accounts Receivable", type=AccountType.ASSET
                ),
                AccountCreate(code="1500", name="Equipment", type=AccountType.ASSET),
                AccountCreate(
                    code="2000", name="Accounts Payable", type=AccountType.LIABILITY
                ),
                AccountCreate(
                    code="2300", name="Accrued Liabilities", type=AccountType.LIABILITY
                ),
                AccountCreate(
                    code="3000", name="Owner's Equity", type=AccountType.EQUITY
                ),
                AccountCreate(
                    code="3100", name="Retained Earnings", type=AccountType.EQUITY
                ),
                AccountCreate(
                    code="4000", name="Service Revenue", type=AccountType.REVENUE
                ),
                AccountCreate(
                    code="5000", name="Rent Expense", type=AccountType.EXPENSE
                ),
                AccountCreate(
                    code="5100", name="Payroll Expense", type=AccountType.EXPENSE
                ),
            ]

            for acc in accounts_to_create:
                await account_service.create_account(acc)
            logger.info(f"Created {len(accounts_to_create)} accounts.")
        else:
            logger.info("Chart of Accounts already seeded.")

        # Re-fetch accounts for mapping IDs later
        accounts = await account_service.get_accounts()
        acc_dict = {a.code: a.id for a in accounts}

        # 3. Seed Fiscal Periods
        existing_periods = await period_service.get_periods()
        if not existing_periods:
            logger.info("Creating initial Fiscal Periods...")

            today = date.today()
            # Current month
            start_current = today.replace(day=1)
            # Find last day of current month
            next_month = start_current.replace(day=28) + timedelta(days=4)
            end_current = next_month - timedelta(days=next_month.day)

            period_name = start_current.strftime("%B %Y")

            await period_service.create_period(
                FiscalPeriodCreate(
                    name=period_name, start_date=start_current, end_date=end_current
                )
            )
            logger.info(f"Created fiscal period: {period_name}")
        else:
            logger.info("Fiscal periods already seeded.")

        # Re-fetch period for JE
        periods = await period_service.get_periods()
        active_period = periods[0]

        # 4. Seed Journal Entries
        existing_jes = await je_service.get_journal_entries()
        if not existing_jes:
            logger.info("Creating initial Journal Entry (Owner Investment)...")

            # Find cash and equity accounts
            cash_id = acc_dict.get("1000")
            equity_id = acc_dict.get("3000")

            if cash_id and equity_id:
                je = JournalEntryCreate(
                    description="Initial owner investment",
                    entry_date=active_period.start_date,
                    period_id=active_period.id,
                    lines=[
                        LedgerLineCreate(
                            account_id=cash_id,
                            debit=10000.0,
                            credit=0.0,
                            description="Cash deposit",
                        ),
                        LedgerLineCreate(
                            account_id=equity_id,
                            debit=0.0,
                            credit=10000.0,
                            description="Owner equity contribution",
                        ),
                    ],
                )
                await je_service.create_journal_entry(je, admin.id)
                logger.info("Created initial journal entry.")
            else:
                logger.warning("Could not create JE: required accounts missing.")
        else:
            logger.info("Journal entries already seeded.")

        # 5. Seed Vendor
        existing_vendors = await vendor_service.get_vendors()
        if not existing_vendors:
            logger.info("Creating initial Vendor...")
            rent_act_id = acc_dict.get("5000")
            await vendor_service.create_vendor(
                VendorCreate(
                    name="Acme Corp Real Estate",
                    email="billing@acme.com",
                    phone="555-0199",
                    default_expense_account_id=rent_act_id,
                )
            )
            logger.info("Created initial Vendor.")
        else:
            logger.info("Vendors already seeded.")

        # 6. Seed Customer
        existing_customers = await customer_service.get_customers()
        if not existing_customers:
            logger.info("Creating initial Customer...")
            rev_act_id = acc_dict.get("4000")
            await customer_service.create_customer(
                CustomerCreate(
                    name="Globex Corporation",
                    email="ap@globex.com",
                    phone="555-0811",
                    default_revenue_account_id=rev_act_id,
                )
            )
            logger.info("Created initial Customer.")
        else:
            logger.info("Customers already seeded.")

        logger.info("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_db())
