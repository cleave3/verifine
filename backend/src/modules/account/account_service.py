import uuid
from typing import Sequence, Optional
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, and_
from src.core.database import get_session
from src.models.account import Account
from src.modules.account.account_schema import AccountCreate, AccountUpdate
from src.core.audit import log_audit_event


class AccountService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_accounts(self, org_id: uuid.UUID) -> Sequence[Account]:
        statement = (
            select(Account).where(Account.org_id == org_id).order_by(Account.code)
        )
        results = await self.session.exec(statement)
        return results.all()

    async def get_account_by_code(
        self, org_id: uuid.UUID, code: str
    ) -> Optional[Account]:
        statement = select(Account).where(
            and_(Account.code == code, Account.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def get_account_by_id(
        self, org_id: uuid.UUID, account_id: int
    ) -> Optional[Account]:
        statement = select(Account).where(
            and_(Account.id == account_id, Account.org_id == org_id)
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_account(
        self, org_id: uuid.UUID, account_in: AccountCreate, user_id: int
    ) -> Account:
        db_account = Account(
            org_id=org_id,
            code=account_in.code,
            name=account_in.name,
            type=account_in.type,
            is_active=account_in.is_active,
            description=account_in.description,
        )
        self.session.add(db_account)
        await self.session.commit()
        await self.session.refresh(db_account)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="CREATE_ACCOUNT",
            entity_type="Account",
            entity_id=str(db_account.id),
            previous_state=None,
            new_state=db_account.model_dump(),
        )
        await self.session.commit()

        return db_account

    async def update_account(
        self,
        org_id: uuid.UUID,
        account_id: int,
        account_in: AccountUpdate,
        user_id: int,
    ) -> Optional[Account]:
        db_account = await self.get_account_by_id(org_id, account_id)
        if not db_account:
            return None

        prev_state = db_account.model_dump()

        if account_in.name is not None:
            db_account.name = account_in.name
        if account_in.is_active is not None:
            db_account.is_active = account_in.is_active
        if account_in.description is not None:
            db_account.description = account_in.description

        self.session.add(db_account)
        await self.session.commit()
        await self.session.refresh(db_account)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="UPDATE_ACCOUNT",
            entity_type="Account",
            entity_id=str(db_account.id),
            previous_state=prev_state,
            new_state=db_account.model_dump(),
        )
        await self.session.commit()

        return db_account

    async def activate_account(
        self, org_id: uuid.UUID, account_id: int, user_id: int
    ) -> Optional[Account]:
        db_account = await self.get_account_by_id(org_id, account_id)
        if not db_account:
            return None

        if db_account.is_active:
            return db_account

        prev_state = db_account.model_dump()
        db_account.is_active = True

        self.session.add(db_account)
        await self.session.commit()
        await self.session.refresh(db_account)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="ACTIVATE_ACCOUNT",
            entity_type="Account",
            entity_id=str(db_account.id),
            previous_state=prev_state,
            new_state=db_account.model_dump(),
        )
        await self.session.commit()

        return db_account

    async def deactivate_account(
        self, org_id: uuid.UUID, account_id: int, user_id: int
    ) -> Optional[Account]:
        db_account = await self.get_account_by_id(org_id, account_id)
        if not db_account:
            return None

        if not db_account.is_active:
            return db_account

        prev_state = db_account.model_dump()
        db_account.is_active = False

        self.session.add(db_account)
        await self.session.commit()
        await self.session.refresh(db_account)

        await log_audit_event(
            session=self.session,
            org_id=org_id,
            user_id=user_id,
            action="DEACTIVATE_ACCOUNT",
            entity_type="Account",
            entity_id=str(db_account.id),
            previous_state=prev_state,
            new_state=db_account.model_dump(),
        )
        await self.session.commit()

        return db_account


def get_account_service(session: AsyncSession = Depends(get_session)) -> AccountService:
    return AccountService(session=session)
