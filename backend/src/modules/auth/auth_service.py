from typing import Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.core.database import get_session
from src.models.user import User, UserRole
from src.models.organization import Organization
from src.models.account import Account, AccountType
from src.models.fiscal_period import FiscalPeriod, PeriodStatus
import uuid
from datetime import date
from src.modules.auth.auth_schema import UserCreate
from src.core.security import get_password_hash
from datetime import timedelta


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_user_by_email(self, email: str) -> Optional[User]:
        statement = select(User).where(User.email == email)
        result = await self.session.exec(statement)
        return result.first()

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        statement = select(User).where(User.id == user_id)
        result = await self.session.exec(statement)
        return result.first()

    async def create_user(self, user_create: UserCreate) -> User:
        # 1. Create Organization
        org_slug = (
            user_create.org_name.lower().replace(" ", "-") + "-" + str(uuid.uuid4())[:8]
        )
        org = Organization(name=user_create.org_name, slug=org_slug)
        self.session.add(org)
        await self.session.commit()
        await self.session.refresh(org)

        # 2. Seed Default Accounts
        default_accounts = [
            Account(org_id=org.id, code="1000", name="Cash", type=AccountType.ASSET),
            Account(
                org_id=org.id,
                code="1200",
                name="Accounts Receivable",
                type=AccountType.ASSET,
            ),
            Account(
                org_id=org.id,
                code="2000",
                name="Accounts Payable",
                type=AccountType.LIABILITY,
            ),
            Account(
                org_id=org.id,
                code="3000",
                name="Owner's Equity",
                type=AccountType.EQUITY,
            ),
            Account(
                org_id=org.id,
                code="4000",
                name="Sales Revenue",
                type=AccountType.REVENUE,
            ),
            Account(
                org_id=org.id,
                code="5000",
                name="Cost of Goods Sold",
                type=AccountType.EXPENSE,
            ),
            Account(
                org_id=org.id,
                code="6000",
                name="Operating Expenses",
                type=AccountType.EXPENSE,
            ),
            Account(
                org_id=org.id, code="6100", name="Bank Fees", type=AccountType.EXPENSE
            ),
        ]
        self.session.add_all(default_accounts)

        # 3. Seed initial Fiscal Period (Current Month)
        today = date.today()
        start_date = today.replace(day=1)
        next_month = today.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)

        initial_period = FiscalPeriod(
            org_id=org.id,
            name=f"{today.strftime('%B %Y')}",
            start_date=start_date,
            end_date=end_date,
            status=PeriodStatus.OPEN,
        )
        self.session.add(initial_period)

        # 4. Create User
        hashed_password = get_password_hash(user_create.password)
        db_user = User(
            email=user_create.email,
            hashed_password=hashed_password,
            full_name=user_create.full_name,
            role=UserRole.ADMIN,
            org_id=org.id,
        )
        self.session.add(db_user)
        await self.session.commit()
        await self.session.refresh(db_user)
        return db_user


def get_auth_service(session: AsyncSession = Depends(get_session)) -> AuthService:
    return AuthService(session=session)
