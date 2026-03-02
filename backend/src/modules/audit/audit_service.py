from typing import Sequence, Optional
import uuid
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, and_
from src.utils.common import get_pagination_meta
from src.models.audit import AuditLog
from src.models.user import User


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_audit_logs(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 50,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
    ):
        """
        Fetches a paginated list of audit logs explicitly joined against the `User` model,
        ensuring cross-reference user details are included in the return packet.
        """
        statement = (
            select(AuditLog, User)
            .join(User, AuditLog.user_id == User.id)
            .where(AuditLog.org_id == org_id)
        )

        count_statement = select(func.count(AuditLog.id)).where(
            AuditLog.org_id == org_id
        )

        if user_id:
            statement = statement.where(AuditLog.user_id == user_id)
            count_statement = count_statement.where(AuditLog.user_id == user_id)

        if action:
            statement = statement.where(AuditLog.action == action)
            count_statement = count_statement.where(AuditLog.action == action)

        statement = statement.order_by(AuditLog.timestamp.desc())
        statement = statement.offset((page - 1) * page_size).limit(page_size)

        results = await self.session.exec(statement)
        total_result = await self.session.exec(count_statement)
        total_records = total_result.first() or 0

        logs = []
        for audit, user in results.all():
            log_dict = audit.model_dump()
            log_dict["user"] = {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            }
            logs.append(log_dict)

        return {
            "results": logs,
            "meta": get_pagination_meta(page, page_size, total_records),
        }
