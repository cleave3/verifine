import logging
from typing import List
from fastapi import Request, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from jose import jwt, JWTError

from src.core.config import Config
from src.core.database import get_session
from src.models.user import User, UserRole

logger = logging.getLogger("audit")


async def get_current_user(
    request: Request, session: AsyncSession = Depends(get_session)
) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User context missing")

        user = await session.get(User, int(user_id))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def role_required(allowed_roles: List[UserRole]):
    async def role_checker(
        request: Request, current_user: User = Depends(get_current_user)
    ):
        if current_user.role not in allowed_roles:
            action = f"{request.method} {request.url.path}"
            logger.warning(
                f"AUDIT_LOG_DENIED: User {current_user.email} (Role: {current_user.role}) denied access to {action}. Required: {[r.value for r in allowed_roles]}"
            )
            raise HTTPException(
                status_code=403, detail="Not authorized to perform this operation"
            )

        action = f"{request.method} {request.url.path}"
        logger.info(f"AUDIT_LOG_SUCCESS: User {current_user.email} executed {action}")
        return current_user

    return role_checker
