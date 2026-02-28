from typing import Any
import math


def response(status_code: int, message: str, data: Any = None):
    return {
        "status": True,
        "code": status_code,
        "message": message,
        "data": data,
        "error": None,
    }
    

def get_pagination_meta(page: int, page_size: int, total_records: int) -> dict:
    page_count = math.ceil(total_records / page_size) if page_size > 0 else 0
    return {
        "is_first_page": page == 1,
        "is_last_page": page == page_count,
        "current_page": page,
        "previous_page": page - 1 if page > 1 else None,
        "next_page": page + 1 if page < page_count else None,
        "page_count": page_count,
        "total_count": total_records,
    }
