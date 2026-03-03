import logging
import uuid
from typing import Optional, Sequence
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, and_

from src.core.database import get_session
from src.core.security import get_password_hash, verify_password
from src.core.errors import BadRequest
from src.core.audit import log_audit_event
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
        self, org_id: uuid.UUID, current_user_id: int, invite_data: UserInviteRequest
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
        # We need the ID for the audit log, so flush but don't commit yet
        await self.session.flush()

        await log_audit_event(
            self.session,
            org_id=org_id,
            user_id=current_user_id,  # New user ID
            action="INVITE_USER",
            entity_type="User",
            entity_id=str(new_user.id),
            new_state={
                "email": new_user.email,
                "role": new_user.role,
                "full_name": new_user.full_name,
            },
        )

        await self.session.commit()
        await self.session.refresh(new_user)

        logger.info(
            f"MOCK EMAIL: Invitation sent to {new_user.email}. Temporary password: {temp_password}"
        )

        return new_user

    async def update_user_role(
        self,
        org_id: uuid.UUID,
        target_user_id: int,
        current_user_id: int,
        role_data: UserRoleUpdate,
    ) -> User:
        user = await self.session.get(User, target_user_id)
        if not user or user.org_id != org_id:
            raise BadRequest("User not found in your organization")

        # Prevent an admin from demoting themselves if they are the last admin, but that's a nice-to-have.
        previous_role = {"role": user.role, "full_name": user.full_name}
        user.role = role_data.role
        self.session.add(user)

        await log_audit_event(
            self.session,
            org_id=org_id,
            user_id=current_user_id,
            action="UPDATE_USER_ROLE",
            entity_type="User",
            entity_id=str(target_user_id),
            previous_state=previous_role,
            new_state={"role": user.role, "full_name": user.full_name},
        )

        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def deactivate_user(
        self, org_id: uuid.UUID, current_user_id: int, target_user_id: int
    ) -> User:
        user = await self.session.get(User, target_user_id)
        if not user or user.org_id != org_id:
            raise BadRequest("User not found in your organization")

        previous_state = {
            "full_name": user.full_name,
            "is_active": user.is_active,
        }
        user.is_active = False
        self.session.add(user)

        await log_audit_event(
            self.session,
            org_id=org_id,
            user_id=current_user_id,
            action="DEACTIVATE_USER",
            entity_type="User",
            entity_id=str(target_user_id),
            previous_state=previous_state,
            new_state={
                "full_name": user.full_name,
                "is_active": user.is_active,
            },
        )

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def reactivate_user(
        self, org_id: uuid.UUID, current_user_id: int, target_user_id: int
    ) -> User:
        user = await self.session.get(User, target_user_id)
        if not user or user.org_id != org_id:
            raise BadRequest("User not found in your organization")

        previous_state = {
            "full_name": user.full_name,
            "is_active": user.is_active,
        }
        user.is_active = True
        self.session.add(user)

        await log_audit_event(
            self.session,
            org_id=org_id,
            user_id=current_user_id,
            action="REACTIVATE_USER",
            entity_type="User",
            entity_id=str(target_user_id),
            previous_state=previous_state,
            new_state={
                "full_name": user.full_name,
                "is_active": user.is_active,
            },
        )

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

        previous_name = user.full_name
        if profile_data.full_name is not None:
            user.full_name = profile_data.full_name

        self.session.add(user)

        await log_audit_event(
            self.session,
            org_id=user.org_id,
            user_id=user_id,
            action="UPDATE_USER_PROFILE",
            entity_type="User",
            entity_id=str(user_id),
            previous_state={"full_name": previous_name},
            new_state={"full_name": user.full_name},
        )

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
