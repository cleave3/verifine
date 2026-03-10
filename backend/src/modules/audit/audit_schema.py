from typing import Optional, Any, Dict
import uuid
from pydantic import BaseModel
from datetime import datetime


class AuditActionTypeRead(BaseModel):
    name: str
    label: str
    group: str


class AuditUser(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    role: str


class AuditLogEntryOut(BaseModel):
    id: uuid.UUID
    action: str
    entity_type: str
    entity_id: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    timestamp: datetime
    ip_address: Optional[str] = None
    user: AuditUser
