from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.security_roles import get_current_user
from src.models.user import User
from .bank_rec_service import BankRecService
from .bank_rec_schema import (
    BankStatementCreate,
    BankStatementResponse,
    MatchLineRequest,
    MatchSuggestion,
)

from src.utils.common import response

router = APIRouter(prefix="/bank-rec", tags=["Bank Reconciliation"])


def get_bank_rec_service(
    session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    return BankRecService(session, user)


@router.get("/statements")
async def get_statements(
    skip: int = 0,
    limit: int = 100,
    service: BankRecService = Depends(get_bank_rec_service),
):
    data = await service.get_statements(skip, limit)
    return response(200, "Bank statements retrieved successfully", data)


@router.post("/statements")
async def upload_statement(
    data: BankStatementCreate, service: BankRecService = Depends(get_bank_rec_service)
):
    result = await service.upload_statement(data)
    return response(201, "Bank statement uploaded successfully", result)


@router.get("/statements/{statement_id}")
async def get_statement(
    statement_id: int, service: BankRecService = Depends(get_bank_rec_service)
):
    data = await service.get_statement(statement_id)
    return response(200, "Bank statement retrieved successfully", data)


@router.get("/statements/{statement_id}/suggest-matches")
async def suggest_matches(
    statement_id: int, service: BankRecService = Depends(get_bank_rec_service)
):
    data = await service.suggest_matches(statement_id)
    return response(200, "Match suggestions generated successfully", data)


@router.post("/statements/{statement_id}/match")
async def match_lines(
    statement_id: int,
    data: MatchLineRequest,
    service: BankRecService = Depends(get_bank_rec_service),
):
    result = await service.match_lines(statement_id, data)
    return response(200, "Lines matched successfully", result)
