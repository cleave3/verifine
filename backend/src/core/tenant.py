import uuid
from fastapi import Request
from jose import jwt, JWTError
from src.core.config import Config
from src.core.errors import BadRequest


def get_current_org(request: Request) -> uuid.UUID:
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        org_id_str = payload.get("org")
        if not org_id_str:
            raise BadRequest("Organization context missing")
        return uuid.UUID(org_id_str)
    except JWTError:
        raise BadRequest("Invalid token")
    except ValueError:
        raise BadRequest("Invalid Organization ID format")
