from fastapi import APIRouter, Depends, Query, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional
import uuid

from src.core.database import get_session
from src.core.security_roles import get_current_user, role_required
from src.core.tenant import get_current_org
from src.core.audit import log_audit_event
from src.utils.common import response
from src.models.user import User, UserRole
from src.models.expense import ExpenseStatus
from src.modules.expense.expense_schema import ExpenseClaimCreate, ExpenseClaimApprove
from src.modules.expense.expense_service import ExpenseService, get_expense_service

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("")
async def create_expense_claim(
    request: Request,
    payload: ExpenseClaimCreate,
    expense_service: ExpenseService = Depends(get_expense_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
    session: AsyncSession = Depends(get_session),
):
    claim = await expense_service.create_expense_claim(
        org_id, payload.employee_id, payload
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CREATE_EXPENSE_CLAIM",
        entity_type="ExpenseClaim",
        entity_id=str(claim.id),
        new_state=claim.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Expense claim created successfully", claim.model_dump())


@router.get("")
async def get_expense_claims(
    employee_id: Optional[int] = Query(None),
    expense_service: ExpenseService = Depends(get_expense_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    claims = await expense_service.get_expense_claims(org_id, employee_id)
    return response(
        200, "Expense claims retrieved successfully", [c.model_dump() for c in claims]
    )


@router.get("/{claim_id}")
async def get_expense_claim(
    claim_id: int,
    expense_service: ExpenseService = Depends(get_expense_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    claim = await expense_service.get_expense_claim(org_id, claim_id)
    return response(200, "Expense claim retrieved successfully", claim.model_dump())


@router.post("/{claim_id}/approve")
async def approve_expense_claim(
    request: Request,
    claim_id: int,
    payload: ExpenseClaimApprove,
    expense_service: ExpenseService = Depends(get_expense_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    old_claim = await expense_service.get_expense_claim(org_id, claim_id)
    previous_state = old_claim.model_dump()

    claim = await expense_service.update_expense_status(
        org_id=org_id,
        claim_id=claim_id,
        status=ExpenseStatus.APPROVED,
        user_id=current_user.id,
        credit_account_id=payload.credit_account_id,
        period_id=payload.period_id,
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="APPROVE_EXPENSE_CLAIM",
        entity_type="ExpenseClaim",
        entity_id=str(claim.id),
        previous_state=previous_state,
        new_state=claim.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Expense claim approved successfully", claim.model_dump())


@router.post("/{claim_id}/reject")
async def reject_expense_claim(
    request: Request,
    claim_id: int,
    expense_service: ExpenseService = Depends(get_expense_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    old_claim = await expense_service.get_expense_claim(org_id, claim_id)
    previous_state = old_claim.model_dump()

    claim = await expense_service.update_expense_status(
        org_id=org_id,
        claim_id=claim_id,
        status=ExpenseStatus.REJECTED,
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="REJECT_EXPENSE_CLAIM",
        entity_type="ExpenseClaim",
        entity_id=str(claim.id),
        previous_state=previous_state,
        new_state=claim.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Expense claim rejected successfully", claim.model_dump())
