import uuid
from datetime import datetime
from typing import Optional
import sqlalchemy as sa
from decimal import Decimal
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

    # Nigerian Tax Compatibility (NTA 2026) & Flexibility
    tax_regime: str = Field(
        sa_column=sa.Column(sa.String(), nullable=False, server_default="MANUAL"),
        description="MANUAL or NIGERIA_NTA_2026",
    )
    annual_turnover: Decimal = Field(
        sa_column=sa.Column(sa.Numeric(), nullable=False, server_default="0.0"),
        default=0.0,
        max_digits=20,
        decimal_places=2,
    )
    fixed_asset_value: Decimal = Field(
        sa_column=sa.Column(sa.Numeric(), nullable=False, server_default="0.0"),
        default=0.0,
        max_digits=20,
        decimal_places=2,
    )
    cac_registration_number: Optional[str] = Field(
        sa_column=sa.Column(sa.String(), nullable=True),
    )
    is_vat_registered: bool = Field(
        sa_column=sa.Column(sa.Boolean(), nullable=False, server_default="false"),
    )

    created_at: datetime = Field(default_factory=datetime.now)
