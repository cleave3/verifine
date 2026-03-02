import logging
import uuid
from typing import Optional, Sequence
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, and_

from src.core.database import get_session
from src.core.security import get_password_hash, verify_password
from src.core.errors import BadRequest
from src.models.user import User, UserRole
from src.modules.users.users_schema import (
    UserInviteRequest,
    UserRoleUpdate,
    UserPasswordUpdate,
    UserProfileUpdate,
)

logger = logging.getLogger("auth")


class UsersService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_org_users(self, org_id: uuid.UUID) -> Sequence[User]:
        statement = select(User).where(User.org_id == org_id).order_by(User.full_name)
        results = await self.session.exec(statement)
        return results.all()

    async def invite_user(
        self, org_id: uuid.UUID, invite_data: UserInviteRequest
    ) -> User:
        # Check if email is available
        stmt = select(User).where(User.email == invite_data.email)
        existing = (await self.session.exec(stmt)).first()
        if existing:
            raise BadRequest("A user with this email already exists.")

        # Note: in a real app, send an invite email with a signup link/temporary password.
        # Here we generate a temporary password for the sake of completion.
        temp_password = "TemporaryPassword123!"
        hashed_password = get_password_hash(temp_password)

        new_user = User(
            email=invite_data.email,
            full_name=invite_data.full_name,
            role=invite_data.role,
            hashed_password=hashed_password,
            org_id=org_id,
            is_active=True,
        )

        self.session.add(new_user)
        await self.session.commit()
        await self.session.refresh(new_user)

        logger.info(
            f"MOCK EMAIL: Invitation sent to {new_user.email}. Temporary password: {temp_password}"
        )

        return new_user

    async def update_user_role(
        self, org_id: uuid.UUID, target_user_id: int, role_data: UserRoleUpdate
    ) -> User:
        user = await self.session.get(User, target_user_id)
        if not user or user.org_id != org_id:
            raise BadRequest("User not found in your organization")

        # Prevent an admin from demoting themselves if they are the last admin, but that's a nice-to-have.
        user.role = role_data.role
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def deactivate_user(self, org_id: uuid.UUID, target_user_id: int) -> User:
        user = await self.session.get(User, target_user_id)
        if not user or user.org_id != org_id:
            raise BadRequest("User not found in your organization")

        user.is_active = False
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_user_profile(self, user_id: int) -> Optional[User]:
        return await self.session.get(User, user_id)

    async def update_user_profile(
        self, user_id: int, profile_data: UserProfileUpdate
    ) -> User:
        user = await self.session.get(User, user_id)
        if not user:
            raise BadRequest("User not found")

        if profile_data.full_name is not None:
            user.full_name = profile_data.full_name

        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def change_password(self, user_id: int, password_data: UserPasswordUpdate):
        user = await self.session.get(User, user_id)
        if not user:
            raise BadRequest("User not found")

        if not verify_password(password_data.current_password, user.hashed_password):
            raise BadRequest("Incorrect current password")

        user.hashed_password = get_password_hash(password_data.new_password)
        self.session.add(user)
        await self.session.commit()

        return {"success": True, "message": "Password updated successfully"}


def get_users_service(session: AsyncSession = Depends(get_session)) -> UsersService:
    return UsersService(session)
