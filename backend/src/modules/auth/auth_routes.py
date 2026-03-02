from fastapi import APIRouter, Depends, Response, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.security import verify_password, create_access_token, create_refresh_token
from src.core.config import Config
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.auth.auth_schema import LoginRequest, UserCreate
from src.modules.auth.auth_service import AuthService, get_auth_service
from jose import jwt, JWTError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(
    user_in: UserCreate, auth_service: AuthService = Depends(get_auth_service)
):
    user = await auth_service.get_user_by_email(user_in.email)
    if user:
        raise BadRequest("The user with this email already exists in the system.")
    user = await auth_service.create_user(user_in)
    return response(
        201,
        "User created successfully",
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "org_id": str(user.org_id),
        },
    )


@router.post("/login")
async def login(
    request: LoginRequest,
    res: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    user = await auth_service.get_user_by_email(request.email)
    if not user or not verify_password(request.password, user.hashed_password):
        raise BadRequest("Incorrect email or password")

    access_token = create_access_token(user.id, org_id=str(user.org_id))
    refresh_token = create_refresh_token(user.id, org_id=str(user.org_id))

    res.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=Config.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )
    res.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=Config.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
    )

    return response(
        200,
        "Login successful",
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "org_id": str(user.org_id),
        },
    )


@router.post("/logout")
async def logout(res: Response):
    res.delete_cookie("access_token")
    res.delete_cookie("refresh_token")
    return response(200, "Logged out successfully")


@router.get("/me")
async def get_me(
    request: Request, auth_service: AuthService = Depends(get_auth_service)
):
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        user_id = int(payload.get("sub"))

        user = await auth_service.get_user_by_id(user_id)
        if user is None:
            raise BadRequest("User not found")

        return response(
            200,
            "Current User",
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "org_id": str(user.org_id),
            },
        )
    except JWTError:
        raise BadRequest("Invalid token")
