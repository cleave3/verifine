import uuid
from datetime import date
from typing import List, Optional
from fastapi import HTTPException
from sqlmodel import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from dateutil.relativedelta import relativedelta

from src.models.fixed_asset import FixedAsset, AssetStatus, DepreciationSchedule
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)

from src.models.journal_entry import JournalEntryStatus
from src.modules.fixed_asset.fixed_asset_schema import (
    FixedAssetCreate,
    DepreciationRunCreate,
)


class FixedAssetService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_asset(
        self, org_id: uuid.UUID, asset_data: FixedAssetCreate
    ) -> FixedAsset:
        asset = FixedAsset(**asset_data.model_dump(), organization_id=org_id)
        self.session.add(asset)
        await self.session.commit()
        await self.session.refresh(asset)
        return asset

    async def get_assets(self, org_id: uuid.UUID) -> List[FixedAsset]:
        stmt = select(FixedAsset).where(FixedAsset.organization_id == org_id)
        result = await self.session.exec(stmt)
        return list(result.all())

    async def get_asset(self, org_id: uuid.UUID, asset_id: int) -> FixedAsset:
        stmt = select(FixedAsset).where(
            FixedAsset.id == asset_id, FixedAsset.organization_id == org_id
        )
        asset = (await self.session.exec(stmt)).scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return asset

    async def run_depreciation(
        self,
        org_id: uuid.UUID,
        user_id: int,
        target_date: date,
        period_id: int,
    ) -> List[DepreciationSchedule]:
        """
        Calculates straight-line depreciation up to the target_date for all ACTIVE assets.
        Post a single journal entry for the batch of depreciations.
        """
        # 1. Fetch all active assets
        stmt = select(FixedAsset).where(
            FixedAsset.organization_id == org_id,
            FixedAsset.status == AssetStatus.ACTIVE,
            FixedAsset.purchase_date <= target_date,
        )
        assets = (await self.session.exec(stmt)).all()

        if not assets:
            return []

        # 2. Collect lines for the batch journal entry
        new_schedules = []
        lines = []

        for asset in assets:
            # Calculate monthly depreciation: (Price - Salvage) / Useful Life
            depreciable_base = asset.purchase_price - asset.salvage_value
            monthly_depreciation = (
                depreciable_base / asset.useful_life_months
                if asset.useful_life_months > 0
                else 0
            )

            if monthly_depreciation <= 0:
                continue

            # Optional: check if already fully depreciated by looking at past schedules
            # For simplicity, we assume one month of depreciation is to be posted.
            # A more robust engine would check the EXACT accumulated amount.
            sched_stmt = select(DepreciationSchedule).where(
                DepreciationSchedule.asset_id == asset.id
            )
            existing_schedules = (await self.session.exec(sched_stmt)).all()

            # Check total accumulated depreciation
            total_accumulated = sum(s.amount for s in existing_schedules)
            remaining_value = depreciable_base - total_accumulated

            # Determine actual depreciation amount for this run
            if remaining_value <= 0:
                continue  # Fully depreciated

            depreciation_amount = min(monthly_depreciation, remaining_value)

            # Add Ledger lines (Debit Expense, Credit Accum. Depreciation)
            lines.extend(
                [
                    LedgerLineCreate(
                        account_id=asset.depreciation_expense_account_id,
                        description=f"Depreciation Expense: {asset.asset_name}",
                        transaction_debit=depreciation_amount,
                        transaction_credit=0.0,
                        tracking_option_id=asset.tracking_option_id,
                    ),
                    LedgerLineCreate(
                        account_id=asset.accumulated_depreciation_account_id,
                        description=f"Accumulated Depreciation: {asset.asset_name}",
                        transaction_debit=0.0,
                        transaction_credit=depreciation_amount,
                        tracking_option_id=asset.tracking_option_id,
                    ),
                ]
            )

            # Create Schedule Record
            new_schedules.append({"asset_id": asset.id, "amount": depreciation_amount})

        if not lines:
            return []

        # 3. Post Journal Entry
        je_create = JournalEntryCreate(
            description=f"Batch Asset Depreciation Run for {target_date.isoformat()}",
            entry_date=target_date,
            period_id=period_id,
            lines=lines,
        )

        journal_service = JournalEntryService(self.session)
        journal_entry = await journal_service.create_journal_entry(
            org_id=org_id,
            je_in=je_create,
            user_id=user_id,
            status=JournalEntryStatus.POSTED,
        )

        # 4. Save Depreciation Schedules
        saved_schedules = []
        for sched_data in new_schedules:
            schedule = DepreciationSchedule(
                organization_id=org_id,
                asset_id=sched_data["asset_id"],
                date_posted=target_date,
                amount=sched_data["amount"],
                journal_entry_id=journal_entry.id,
            )
            self.session.add(schedule)
            saved_schedules.append(schedule)

        await self.session.commit()
        for s in saved_schedules:
            await self.session.refresh(s)

        return saved_schedules

    async def dispose_asset(self, org_id: uuid.UUID, asset_id: int) -> FixedAsset:
        asset = await self.get_asset(org_id, asset_id)
        asset.status = AssetStatus.DISPOSED
        await self.session.commit()
        await self.session.refresh(asset)
        return asset


from fastapi import Depends
from src.core.database import get_session


def get_fixed_asset_service(
    session: AsyncSession = Depends(get_session),
) -> FixedAssetService:
    return FixedAssetService(session)
