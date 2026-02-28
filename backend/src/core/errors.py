from typing import Callable
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


class SendSculptException(Exception):
    pass


class BadRequest(SendSculptException):
    pass


def create_exception_handler(
    status_code: int = 500, message: str = "Internal Server Error"
) -> Callable[[Request, Exception], JSONResponse]:

    async def exception_handler(request: Request, exc: Exception):
        response_status_code = status_code
        response_message = message

        error = str(exc)
        err_message = None

        is_validation_error = isinstance(exc, RequestValidationError)
        is_bad_request = isinstance(exc, BadRequest)
        validation_error = None

        if is_validation_error:
            # Extract the first error message from the validation errors
            if hasattr(exc, "errors") and exc.errors():
                validation_error = exc.errors()[0].get("msg", response_message)

        if is_bad_request:
            error = response_message
            err_message = str(exc)

        if isinstance(exc, HTTPException):
            response_message = exc.detail
            response_status_code = exc.status_code

        return JSONResponse(
            content={
                "status": False,
                "code": response_status_code,
                "message": (
                    validation_error
                    if is_validation_error
                    else err_message if is_bad_request else response_message
                ),
                "data": None,
                "error": response_message if is_validation_error else error,
            },
            status_code=response_status_code,
        )

    return exception_handler
