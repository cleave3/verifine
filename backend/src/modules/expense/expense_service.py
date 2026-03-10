from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from uuid import UUID
from datetime import date
from typing import List, Optional
from fastapi import HTTPException

from src.models.expense import ExpenseClaim, ExpenseStatus
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
from src.modules.expense.expense_schema import ExpenseClaimCreate


class ExpenseService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_expense_claim(
        self, org_id: UUID, emp_id: int, payload: ExpenseClaimCreate
    ) -> ExpenseClaim:
        claim = ExpenseClaim(
            organization_id=org_id,
            employee_id=emp_id,
            date_incurred=payload.date_incurred,
            description=payload.description,
            amount=payload.amount,
            expense_account_id=payload.expense_account_id,
            tracking_option_id=payload.tracking_option_id,
            status=ExpenseStatus.SUBMITTED,
        )
        self.session.add(claim)
        await self.session.commit()
        await self.session.refresh(claim)
        return claim

    async def get_expense_claims(
        self, org_id: UUID, emp_id: Optional[int] = None
    ) -> List[ExpenseClaim]:
        query = select(ExpenseClaim).where(ExpenseClaim.organization_id == org_id)
        if emp_id:
            query = query.where(ExpenseClaim.employee_id == emp_id)
        result = await self.session.exec(query.order_by(ExpenseClaim.created_at.desc()))
        return list(result.all())

    async def get_expense_claim(self, org_id: UUID, claim_id: int) -> ExpenseClaim:
        claim = await self.session.get(ExpenseClaim, claim_id)
        if not claim or claim.organization_id != org_id:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        return claim

    async def update_expense_status(
        self,
        org_id: UUID,
        claim_id: int,
        status: ExpenseStatus,
        user_id: int = None,
        credit_account_id: int = None,
        period_id: int = None,
    ) -> ExpenseClaim:
        claim = await self.get_expense_claim(org_id, claim_id)

        if claim.status != ExpenseStatus.SUBMITTED and status == ExpenseStatus.APPROVED:
            raise HTTPException(
                status_code=400, detail="Only submitted claims can be approved"
            )

        claim.status = status

        if status == ExpenseStatus.APPROVED:
            if not credit_account_id or not period_id or not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="Missing accounting details to approve claim",
                )

            # Post journal entry
            lines = [
                LedgerLineCreate(
                    account_id=claim.expense_account_id,
                    description=f"Expense: {claim.description}",
                    transaction_debit=claim.amount,
                    transaction_credit=0.0,
                ),
                LedgerLineCreate(
                    account_id=credit_account_id,
                    description=f"Expense Reimbursement Payable: {claim.description}",
                    transaction_debit=0.0,
                    transaction_credit=claim.amount,
                ),
            ]

            je_create = JournalEntryCreate(
                description=f"Expense Claim Approved - {claim.description}",
                entry_date=claim.date_incurred,
                period_id=period_id,
                lines=lines,
            )

            journal_service = JournalEntryService(self.session)
            journal_entry = await journal_service.create_journal_entry(
                org_id=org_id, je_in=je_create, user_id=user_id
            )
            claim.journal_entry_id = journal_entry.id

        self.session.add(claim)
        await self.session.commit()
        await self.session.refresh(claim)
        return claim


from fastapi import Depends
from src.core.database import get_session


def get_expense_service(session: AsyncSession = Depends(get_session)) -> ExpenseService:
    return ExpenseService(session)
