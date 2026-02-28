from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.account.account_schema import AccountCreate, AccountUpdate
from src.modules.account.account_service import AccountService, get_account_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/")
async def list_accounts(account_service: AccountService = Depends(get_account_service)):
    accounts = await account_service.get_accounts()
    return response(
        200, "Accounts retrieved successfully", [a.model_dump() for a in accounts]
    )


@router.post("/")
async def create_account(
    account_in: AccountCreate,
    account_service: AccountService = Depends(get_account_service),
):
    existing = await account_service.get_account_by_code(account_in.code)
    if existing:
        raise BadRequest(f"Account with code {account_in.code} already exists.")

    account = await account_service.create_account(account_in)
    return response(201, "Account created successfully", account.model_dump())


@router.patch("/{id}")
async def update_account(
    id: int,
    account_in: AccountUpdate,
    account_service: AccountService = Depends(get_account_service),
):
    updated = await account_service.update_account(id, account_in)
    if not updated:
        raise BadRequest("Account not found")

    return response(200, "Account updated successfully", updated.model_dump())
