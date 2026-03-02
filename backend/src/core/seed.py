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
                    email=admin_email,
                    password="password123",
                    full_name="System Admin",
                    org_name="Verifine System",
                )
            )
        else:
            logger.info("Admin user already exists.")

        # Re-fetch accounts for mapping IDs later
        accounts = await account_service.get_accounts(admin.org_id)
        acc_dict = {a.code: a.id for a in accounts}

        # 3. Seed Fiscal Periods (Now handled on User Creation basically, but let's re-fetch)
        periods = await period_service.get_periods(admin.org_id)
        active_period = periods[0] if periods else None

        # 4. Seed Journal Entries
        if active_period:
            existing_jes = await je_service.get_journal_entries(admin.org_id)
            if not existing_jes["results"]:
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
                    await je_service.create_journal_entry(admin.org_id, je, admin.id)
                    logger.info("Created initial journal entry.")
                else:
                    logger.warning("Could not create JE: required accounts missing.")
            else:
                logger.info("Journal entries already seeded.")

        # 5. Seed Vendor
        existing_vendors = await vendor_service.get_vendors(admin.org_id)
        if not existing_vendors:
            logger.info("Creating initial Vendor...")
            rent_act_id = acc_dict.get("6000")
            await vendor_service.create_vendor(
                admin.org_id,
                VendorCreate(
                    name="Acme Corp Real Estate",
                    email="billing@acme.com",
                    phone="555-0199",
                    default_expense_account_id=rent_act_id,
                ),
            )
            logger.info("Created initial Vendor.")
        else:
            logger.info("Vendors already seeded.")

        # 6. Seed Customer
        existing_customers = await customer_service.get_customers(admin.org_id)
        if not existing_customers:
            logger.info("Creating initial Customer...")
            rev_act_id = acc_dict.get("4000")
            await customer_service.create_customer(
                admin.org_id,
                CustomerCreate(
                    name="Globex Corporation",
                    email="ap@globex.com",
                    phone="555-0811",
                    default_revenue_account_id=rev_act_id,
                ),
            )
            logger.info("Created initial Customer.")
        else:
            logger.info("Customers already seeded.")

        logger.info("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_db())
