from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.core.config import Config
from src.core.database import connect_to_db, disconnect_from_db
from src.core.errors import create_exception_handler, VerifineException, BadRequest
from src.routes.routes import api_router
from src.utils.common import response


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_db()
    from src.core.seed import seed_db

    await seed_db()
    yield
    await disconnect_from_db()


app = FastAPI(
    title=Config.PROJECT_NAME,
    openapi_url=f"{Config.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(
    Exception, create_exception_handler(500, "Internal Server Error")
)
app.add_exception_handler(
    StarletteHTTPException, create_exception_handler(400, "Bad Request")
)
app.add_exception_handler(
    RequestValidationError, create_exception_handler(422, "Validation Error")
)
app.add_exception_handler(
    VerifineException, create_exception_handler(400, "Bad Request")
)
# Map standard HTTP exceptions directly to ensure identical output formats
app.add_exception_handler(HTTPException, create_exception_handler(400, "Bad Request"))

app.include_router(api_router, prefix=Config.API_V1_STR)


@app.get("/")
def health_check():
    return response(200, "Verifine API is running")
