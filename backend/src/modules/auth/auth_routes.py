from datetime import timedelta
from fastapi import APIRouter, Depends, Response, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.security import verify_password, create_access_token, create_refresh_token
from src.core.config import Config
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.auth.auth_schema import (
    LoginRequest,
    UserCreate,
    MFAVerifyRequest,
    MFALoginRequest,
)
from src.modules.auth.auth_service import AuthService, get_auth_service
from src.core.audit import log_audit_event
from src.models.user import User
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

    if user.mfa_enabled:
        # Generate a temporary MFA token
        mfa_token = create_access_token(
            user.id, org_id=str(user.org_id), expires_delta=timedelta(minutes=5)
        )
        # Add a special claim to indicate this is for MFA
        payload = jwt.decode(
            mfa_token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM]
        )
        payload["mfa_pending"] = True
        mfa_token = jwt.encode(payload, Config.SECRET_KEY, algorithm=Config.ALGORITHM)

        return response(
            200, "MFA Required", {"mfa_required": True, "mfa_token": mfa_token}
        )

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


@router.post("/mfa/setup")
async def mfa_setup(
    auth_service: AuthService = Depends(get_auth_service),
    request: Request = None,
):
    # This should be protected by regular auth
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")

    payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
    user_id = int(payload.get("sub"))
    user = await auth_service.get_user_by_id(user_id)

    setup_data = await auth_service.generate_mfa_setup(user)
    return response(200, "MFA setup initiated", setup_data)


@router.get("/mfa/status")
async def mfa_status(
    auth_service: AuthService = Depends(get_auth_service),
    request: Request = None,
):
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")

    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise BadRequest("Invalid token")

    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise BadRequest("User not found")

    status = {"mfa_enabled": user.mfa_enabled}
    if user.mfa_secret and not user.mfa_enabled:
        # If secret exists but not enabled, return setup data for persistence
        setup_data = await auth_service.generate_mfa_setup(user)
        status.update(setup_data)

    return response(200, "MFA status retrieved", status)


@router.post("/mfa/verify")
async def mfa_verify(
    verify_in: MFAVerifyRequest,
    auth_service: AuthService = Depends(get_auth_service),
    request: Request = None,
):
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")

    payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
    user_id = int(payload.get("sub"))
    user = await auth_service.get_user_by_id(user_id)

    success = await auth_service.verify_and_enable_mfa(user, verify_in.code)
    if not success:
        raise BadRequest("Invalid MFA code")

    return response(200, "MFA enabled successfully")


@router.post("/mfa/login")
async def mfa_login(
    login_in: MFALoginRequest,
    res: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        payload = jwt.decode(
            login_in.mfa_token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM]
        )
        if not payload.get("mfa_pending"):
            raise BadRequest("Invalid MFA token")
        user_id = int(payload.get("sub"))
    except JWTError:
        raise BadRequest("Invalid or expired MFA token")

    user = await auth_service.get_user_by_id(user_id)
    if not user or user.email != login_in.email:
        raise BadRequest("Invalid request")

    if not await auth_service.verify_mfa_login(user, login_in.code):
        raise BadRequest("Invalid MFA code")

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


@router.post("/mfa/disable")
async def mfa_disable(
    auth_service: AuthService = Depends(get_auth_service),
    request: Request = None,
):
    token = request.cookies.get("access_token")
    if not token:
        raise BadRequest("Not authenticated")

    payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
    user_id = int(payload.get("sub"))
    user = await auth_service.get_user_by_id(user_id)

    await auth_service.disable_mfa(user)
    return response(200, "MFA disabled successfully")


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
