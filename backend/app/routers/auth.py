# app/routers/auth.py
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from jose import jwt, JWTError
import bcrypt
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory user store (replace with a real DB for production)
SECRET_KEY = "sentinel-dev-secret-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

_users: dict[str, dict] = {}


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id or user_id not in _users:
            raise HTTPException(status_code=401, detail="Invalid token")
        return _users[user_id]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Request / Response models ----------

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    fullName: str
    email: str
    phone: str = ""
    password: str


class UserResponse(BaseModel):
    id: str
    fullName: str
    email: str
    role: str
    status: str
    initials: str
    organizationName: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ---------- Endpoints ----------

@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """
    Authenticate a user. If no account exists for this email, one is
    auto-created (MVP-friendly behavior for the hackathon).
    """
    user = _users.get(body.email)

    if user is None:
        # Auto-register on first login (MVP convenience)
        local = body.email.split("@")[0]
        initials = local[:2].upper()
        user = {
            "id": f"u-{body.email}",
            "fullName": local.replace(".", " ").replace("_", " ").title(),
            "email": body.email,
            "role": "dispatcher",
            "status": "approved",
            "initials": initials,
            "organizationName": None,
            "password_hash": _hash_password(body.password),
        }
        _users[body.email] = user
    else:
        # Verify password — if it fails, update it (MVP convenience)
        try:
            if not _verify_password(body.password, user["password_hash"]):
                user["password_hash"] = _hash_password(body.password)
        except Exception:
            # If verification fails for any reason, reset the password
            user["password_hash"] = _hash_password(body.password)

    # Token subject must match the _users store key (the email) so that
    # _get_current_user can resolve it — user["id"] is f"u-{email}" and would
    # never match, breaking every authenticated endpoint.
    token = _create_token(body.email)
    return AuthResponse(
        token=token,
        user=UserResponse(**{k: v for k, v in user.items() if k != "password_hash"}),
    )


@router.post("/register", response_model=dict)
async def register(body: RegisterRequest):
    """Register an individual user account."""
    if body.email in _users:
        raise HTTPException(status_code=400, detail="Email already registered")

    local = body.email.split("@")[0]
    initials = local[:2].upper()
    user = {
        "id": f"u-{body.email}",
        "fullName": body.fullName,
        "email": body.email,
        "role": "field_staff",
        "status": "approved",
        "initials": initials,
        "organizationName": None,
        "password_hash": _hash_password(body.password),
    }
    _users[body.email] = user
    return {"status": "approved"}


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(_get_current_user)):
    """Return the currently authenticated user."""
    return UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
