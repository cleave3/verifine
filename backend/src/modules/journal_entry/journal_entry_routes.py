import uuid
from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from jose import jwt, JWTError
from src.core.tenant import get_current_org

from src.core.database import get_session
from src.core.errors import BadRequest
from src.core.config import Config
from src.utils.common import response
from src.core.security_roles import role_required
from src.models.user import User, UserRole
from src.modules.journal_entry.journal_entry_schema import JournalEntryCreate
from src.modules.journal_entry.journal_entry_service import (
    JournalEntryService,
    get_journal_entry_service,
)

router = APIRouter(prefix="/journal-entries", tags=["journal_entries"])


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
    org_id: uuid.UUID = Depends(get_current_org),
):
    entries = await je_service.get_journal_entries(
        org_id=org_id,
        page=page,
        page_size=page_size,
        status=status,
        start_date=start_date,
        end_date=end_date,
    )

    data = []
    for entry in entries["results"]:
        je_dict = entry.model_dump()
        je_dict["lines"] = [line.model_dump() for line in entry.lines]
        data.append(je_dict)

    return response(
        200,
        "Journal entries retrieved successfully",
        data={"results": data, "page_info": entries["meta"]},
    )


@router.post("/")
async def create_journal_entry(
    request: Request,
    je_in: JournalEntryCreate,
    je_service: JournalEntryService = Depends(get_journal_entry_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    entry = await je_service.create_journal_entry(org_id, je_in, current_user.id)

    je_dict = entry.model_dump()
    je_dict["lines"] = [line.model_dump() for line in entry.lines]

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CREATE_JOURNAL_ENTRY_DRAFT",
        entity_type="JournalEntry",
        entity_id=str(entry.id),
        new_state=je_dict,
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Journal entry saved as draft", je_dict)


@router.post("/{je_id}/post")
async def post_journal_entry(
    je_id: int,
    request: Request,
    je_service: JournalEntryService = Depends(get_journal_entry_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    entry = await je_service.post_journal_entry(org_id, je_id)

    je_dict = entry.model_dump()
    je_dict["lines"] = [line.model_dump() for line in entry.lines]

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="POST_JOURNAL_ENTRY",
        entity_type="JournalEntry",
        entity_id=str(entry.id),
        new_state=je_dict,
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Journal entry posted successfully", je_dict)


@router.put("/{je_id}")
async def update_journal_entry(
    je_id: int,
    je_in: JournalEntryCreate,
    request: Request,
    je_service: JournalEntryService = Depends(get_journal_entry_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
    session: AsyncSession = Depends(get_session),
):
    from src.core.audit import log_audit_event

    entry = await je_service.update_journal_entry(org_id, je_id, je_in, current_user.id)

    je_dict = entry.model_dump()
    je_dict["lines"] = [line.model_dump() for line in entry.lines]

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_JOURNAL_ENTRY_DRAFT",
        entity_type="JournalEntry",
        entity_id=str(entry.id),
        new_state=je_dict,
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Journal entry draft updated", je_dict)
