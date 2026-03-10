from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    org_name: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None


class MFASetupResponse(BaseModel):
    secret: str
    qr_code: str
    provisioning_uri: str


class MFAVerifyRequest(BaseModel):
    code: str


class MFALoginRequest(BaseModel):
    email: EmailStr
    code: str
    mfa_token: str
