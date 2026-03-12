from sqlmodel import SQLModel, Field, Relationship
import uuid
from typing import Optional, List
from datetime import datetime

class AiThread(SQLModel, table=True):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str = Field(default="New Conversation")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    messages: List["AiMessage"] = Relationship(back_populates="thread", cascade_delete=True)


class AiMessage(SQLModel, table=True):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    thread_id: uuid.UUID = Field(foreign_key="aithread.id", index=True)
    role: str = Field(description="user or assistant")
    content: str
    created_at: datetime = Field(default_factory=datetime.now)

    thread: AiThread = Relationship(back_populates="messages")
