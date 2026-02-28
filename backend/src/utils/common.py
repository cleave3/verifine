from typing import Any


def response(status_code: int, message: str, data: Any = None):
    return {
        "status": True,
        "code": status_code,
        "message": message,
        "data": data,
        "error": None,
    }
