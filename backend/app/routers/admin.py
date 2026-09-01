# app/routers/admin.py
import logging
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store
_pending_users: list[dict] = []


@router.get("/pending-users")
async def pending_users():
    """Return users awaiting approval."""
    return _pending_users


@router.patch("/users/{user_id}/approve")
async def approve_user(user_id: str):
    """Approve a pending user."""
    return {"id": user_id, "status": "approved"}
