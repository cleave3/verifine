from sqlmodel import SQLModel, Field
import sqlalchemy as sa
from pydantic import EmailStr
from typing import Optional
import uuid
from enum import Enum


class UserRole(str, Enum):
    VIEWER = "viewer"
    CLERK = "clerk"
    ACCOUNTANT = "accountant"
    CONTROLLER = "controller"
    ADMIN = "admin"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: EmailStr = Field(unique=True, index=True)
    hashed_password: str
    full_name: str | None = None
    role: UserRole = Field(
        default=UserRole.VIEWER,
        sa_type=sa.Enum(UserRole, native_enum=False),
    )
    is_active: bool = True
    is_superuser: bool = False
    mfa_enabled: bool = Field(
        sa_column=sa.Column(sa.Boolean(), nullable=False, server_default="false")
    )
    mfa_secret: Optional[str] = Field(sa_column=sa.Column(sa.String(), nullable=True))
    org_id: uuid.UUID = Field(foreign_key="organization.id")
