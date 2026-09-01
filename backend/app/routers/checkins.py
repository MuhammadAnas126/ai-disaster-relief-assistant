# app/routers/checkins.py
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_checkins():
    """Return all check-ins."""
    return []
