# app/routers/alerts.py
import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store
_alerts: list[dict] = []
_counter = 0


def get_alerts() -> list[dict]:
    """Public accessor so the Admin AI Assistant can read broadcast history."""
    return list(_alerts)


class AlertCreate(BaseModel):
    level: str
    message: str


@router.get("")
async def list_alerts():
    """Return all alerts."""
    return _alerts


@router.post("")
async def send_alert(body: AlertCreate):
    """Broadcast a new alert."""
    global _counter
    _counter += 1
    alert = {
        "id": f"al-{_counter}",
        "level": body.level,
        "message": body.message,
        "sentAt": datetime.now(timezone.utc).isoformat(),
        "sentBy": "System",
    }
    _alerts.append(alert)
    return alert
