from pydantic import BaseModel, EmailStr
from src.models.user import UserRole
import uuid


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    org_id: uuid.UUID
    is_active: bool


class UserInviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.VIEWER


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserProfileUpdate(BaseModel):
    full_name: str | None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str
