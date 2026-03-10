from datetime import date, datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import enum
from sqlalchemy import Column, Enum
from uuid import UUID


class AssetStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISPOSED = "DISPOSED"


class FixedAsset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")

    asset_name: str
    description: Optional[str] = None
    serial_number: Optional[str] = None

    purchase_date: date
    purchase_price: float = Field(default=0.0)
    salvage_value: float = Field(default=0.0)
    useful_life_months: int = Field(default=12)

    # Financial Mapping
    asset_account_id: int = Field(foreign_key="account.id")
    depreciation_expense_account_id: int = Field(foreign_key="account.id")
    accumulated_depreciation_account_id: int = Field(foreign_key="account.id")
    tracking_option_id: Optional[int] = Field(
        default=None, foreign_key="trackingoption.id"
    )

    status: AssetStatus = Field(
        sa_column=Column(Enum(AssetStatus)), default=AssetStatus.ACTIVE
    )

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class DepreciationSchedule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organization.id")
    asset_id: int = Field(foreign_key="fixedasset.id")

    date_posted: date
    amount: float = Field(default=0.0)
    journal_entry_id: int = Field(foreign_key="journalentry.id")

    created_at: datetime = Field(default_factory=datetime.now)
