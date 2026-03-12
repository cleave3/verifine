from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

class MessageRequest(BaseModel):
    thread_id: Optional[uuid.UUID] = None
    message: str

class MessageResponse(BaseModel):
    thread_id: uuid.UUID
    message: str
    role: str = "assistant"
    created_at: datetime

class ThreadResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

class ThreadDetailResponse(ThreadResponse):
    messages: List[MessageResponse]
