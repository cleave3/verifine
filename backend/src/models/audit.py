from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON
from datetime import datetime
import uuid


class AuditLog(SQLModel, table=True):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(index=True)
    user_id: int = Field(foreign_key="user.id")
    action: str  # e.g., "POST_JOURNAL", "CLOSE_PERIOD", "VOID_INVOICE"
    entity_type: str  # e.g., "JournalEntry"
    entity_id: str
    previous_state: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    new_state: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None
