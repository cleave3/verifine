from typing import List
from fastapi import APIRouter, Depends, Body
from src.models.user import User, UserRole
from src.core.tenant import get_current_org
from src.core.security_roles import get_current_user, role_required
from src.utils.common import response
from src.modules.users.users_schema import (
    UserRead,
    UserInviteRequest,
    UserRoleUpdate,
    UserProfileUpdate,
    UserPasswordUpdate,
)
from src.modules.users.users_service import UsersService, get_users_service
import uuid

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=dict)
async def list_org_users(
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    users_service: UsersService = Depends(get_users_service),
):
    users = await users_service.get_org_users(org_id)
    return response(
        200,
        "Users retrieved successfully",
        [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "org_id": str(u.org_id),
            }
            for u in users
        ],
    )


@router.post("/invite", response_model=dict)
async def invite_user(
    invite_req: UserInviteRequest,
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN])),
    users_service: UsersService = Depends(get_users_service),
):
    new_user = await users_service.invite_user(org_id, invite_req)
    return response(
        201,
        "User invited successfully",
        {"id": new_user.id, "email": new_user.email, "role": new_user.role},
    )


@router.patch("/{user_id}/role", response_model=dict)
async def update_role(
    user_id: int,
    role_update: UserRoleUpdate,
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN])),
    users_service: UsersService = Depends(get_users_service),
):
    updated = await users_service.update_user_role(org_id, user_id, role_update)
    return response(200, "User role updated", {"id": updated.id, "role": updated.role})


@router.patch("/{user_id}/deactivate", response_model=dict)
async def deactivate_user(
    user_id: int,
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN])),
    users_service: UsersService = Depends(get_users_service),
):
    updated = await users_service.deactivate_user(org_id, user_id)
    return response(
        200,
        "User access deactivated",
        {"id": updated.id, "is_active": updated.is_active},
    )


@router.get("/profile", response_model=dict)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    users_service: UsersService = Depends(get_users_service),
):
    profile = await users_service.get_user_profile(current_user.id)
    return response(
        200,
        "Profile retrieved",
        {
            "id": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "org_id": str(profile.org_id),
        },
    )


@router.patch("/profile", response_model=dict)
async def update_my_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    users_service: UsersService = Depends(get_users_service),
):
    updated = await users_service.update_user_profile(current_user.id, profile_update)
    return response(
        200,
        "Profile updated successfully",
        {"id": updated.id, "full_name": updated.full_name},
    )


@router.patch("/password", response_model=dict)
async def change_my_password(
    pwd_update: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    users_service: UsersService = Depends(get_users_service),
):
    result = await users_service.change_password(current_user.id, pwd_update)
    return response(200, result["message"])
