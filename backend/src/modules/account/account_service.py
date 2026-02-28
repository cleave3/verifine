from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.core.database import get_session
from src.models.account import Account
from src.modules.account.account_schema import AccountCreate, AccountUpdate


class AccountService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_accounts(self) -> Sequence[Account]:
        statement = select(Account).order_by(Account.code)
        results = await self.session.exec(statement)
        return results.all()

    async def get_account_by_code(self, code: str) -> Optional[Account]:
        statement = select(Account).where(Account.code == code)
        result = await self.session.exec(statement)
        return result.first()

    async def get_account_by_id(self, account_id: int) -> Optional[Account]:
        return await self.session.get(Account, account_id)

    async def create_account(self, account_in: AccountCreate) -> Account:
        db_account = Account(
            code=account_in.code,
            name=account_in.name,
            type=account_in.type,
            is_active=account_in.is_active,
            description=account_in.description,
        )
        self.session.add(db_account)
        await self.session.commit()
        await self.session.refresh(db_account)
        return db_account

    async def update_account(
        self, account_id: int, account_in: AccountUpdate
    ) -> Optional[Account]:
        db_account = await self.get_account_by_id(account_id)
        if not db_account:
            return None

        if account_in.name is not None:
            db_account.name = account_in.name
        if account_in.is_active is not None:
            db_account.is_active = account_in.is_active
        if account_in.description is not None:
            db_account.description = account_in.description

        self.session.add(db_account)
        await self.session.commit()
        await self.session.refresh(db_account)
        return db_account


def get_account_service(session: AsyncSession = Depends(get_session)) -> AccountService:
    return AccountService(session=session)
