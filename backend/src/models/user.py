from sqlmodel import SQLModel, Field
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
    role: UserRole = Field(default=UserRole.VIEWER)
    is_active: bool = True
    is_superuser: bool = False
    org_id: uuid.UUID = Field(foreign_key="organization.id")
