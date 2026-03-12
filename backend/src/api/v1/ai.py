from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
import uuid
from ...core.database import get_session as get_db
from ...core.security_roles import get_current_user
from ...models.user import User
from ...modules.ai.schemas import MessageRequest, MessageResponse, ThreadResponse, ThreadDetailResponse
from ...modules.ai.service import AiService

router = APIRouter()

@router.post("/chat", response_model=MessageResponse)
async def chat(
    request: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ai_service = AiService(db)
    try:
        response = await ai_service.chat(
            org_id=current_user.org_id,
            user_id=current_user.id,
            message=request.message,
            thread_id=request.thread_id
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/threads", response_model=list[ThreadResponse])
async def get_threads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ai_service = AiService(db)
    return await ai_service.get_threads(current_user.org_id, current_user.id)

@router.get("/threads/{thread_id}", response_model=ThreadDetailResponse)
async def get_thread_details(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ai_service = AiService(db)
    thread = await ai_service.get_thread_details(current_user.org_id, current_user.id, thread_id)
    if not thread:
         raise HTTPException(status_code=404, detail="Thread not found")
    return thread

@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ai_service = AiService(db)
    success = await ai_service.delete_thread(current_user.org_id, current_user.id, thread_id)
    if not success:
        raise HTTPException(status_code=404, detail="Thread not found")
    return {"message": "Thread deleted successfully"}
