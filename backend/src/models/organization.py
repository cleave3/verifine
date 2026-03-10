import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Organization(SQLModel, table=True):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    base_currency_code: str = Field(default="NGN")
    is_active: bool = Field(default=True)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
