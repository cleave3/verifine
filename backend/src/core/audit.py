from typing import Any, Dict, Optional
import uuid
from sqlmodel.ext.asyncio.session import AsyncSession
from src.models.audit import AuditLog


from fastapi.encoders import jsonable_encoder


async def log_audit_event(
    session: AsyncSession,
    org_id: uuid.UUID,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: str,
    previous_state: Optional[Dict[str, Any]] = None,
    new_state: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
):
    """
    Creates an AuditLog entry non-destructively documenting what action a user took.
    """
    audit_entry = AuditLog(
        org_id=org_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        previous_state=jsonable_encoder(previous_state) if previous_state else None,
        new_state=jsonable_encoder(new_state) if new_state else None,
        ip_address=ip_address,
    )
    session.add(audit_entry)

    # We do NOT commit here. We let the caller commit the transaction
    # so the business logic and audit log succeed or fail together as a unit.
