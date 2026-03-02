import uuid
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.errors import BadRequest
from src.core.tenant import get_current_org
from src.utils.common import response
from src.modules.account.account_schema import AccountCreate, AccountUpdate
from src.modules.account.account_service import AccountService, get_account_service
from src.core.security_roles import get_current_user
from src.models.user import User

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/")
async def list_accounts(
    account_service: AccountService = Depends(get_account_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    accounts = await account_service.get_accounts(org_id)
    return response(
        200, "Accounts retrieved successfully", [a.model_dump() for a in accounts]
    )


@router.post("/")
async def create_account(
    account_in: AccountCreate,
    account_service: AccountService = Depends(get_account_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    existing = await account_service.get_account_by_code(org_id, account_in.code)
    if existing:
        raise BadRequest(f"Account with code {account_in.code} already exists.")

    account = await account_service.create_account(org_id, account_in, current_user.id)
    return response(201, "Account created successfully", account.model_dump())


@router.patch("/{id}")
async def update_account(
    id: int,
    account_in: AccountUpdate,
    account_service: AccountService = Depends(get_account_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    updated = await account_service.update_account(
        org_id, id, account_in, current_user.id
    )
    if not updated:
        raise BadRequest("Account not found")

    return response(200, "Account updated successfully", updated.model_dump())
