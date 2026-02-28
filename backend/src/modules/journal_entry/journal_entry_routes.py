from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from jose import jwt, JWTError

from src.core.database import get_session
from src.core.errors import BadRequest
from src.core.config import Config
from src.utils.common import response
from src.modules.journal_entry.journal_entry_schema import JournalEntryCreate
from src.modules.journal_entry.journal_entry_service import (
    JournalEntryService,
    get_journal_entry_service,
)

router = APIRouter(prefix="/journal-entries", tags=["journal_entries"])


async def get_current_user_id(request: Request) -> int:
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        return int(payload.get("sub"))
    except JWTError:
        raise BadRequest("Invalid authentication token")


from datetime import date
from typing import Optional
from src.models.journal_entry import JournalEntryStatus

@router.get("/")
async def list_journal_entries(
    page: int = 1,
    page_size: int = 10,
    status: Optional[JournalEntryStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    je_service: JournalEntryService = Depends(get_journal_entry_service),
):
    entries = await je_service.get_journal_entries(
        page=page, 
        page_size=page_size, 
        status=status, 
        start_date=start_date, 
        end_date=end_date
    )

    data = []
    for entry in entries["results"]:
        je_dict = entry.model_dump()
        je_dict["lines"] = [line.model_dump() for line in entry.lines]
        data.append(je_dict)

    return response(200, "Journal entries retrieved successfully", data={"results": data, "page_info": entries["meta"]})


@router.post("/")
async def create_journal_entry(
    je_in: JournalEntryCreate,
    request: Request,
    je_service: JournalEntryService = Depends(get_journal_entry_service),
):
    user_id = await get_current_user_id(request)

    entry = await je_service.create_journal_entry(je_in, user_id)

    je_dict = entry.model_dump()
    je_dict["lines"] = [line.model_dump() for line in entry.lines]

    return response(201, "Journal entry posted successfully", je_dict)
