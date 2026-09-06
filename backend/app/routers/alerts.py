# app/routers/alerts.py
import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel
from app.services.realtime import emit_alert_new

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store
_alerts: list[dict] = []
_counter = 0


def get_alerts() -> list[dict]:
    """Public accessor so the Admin AI Assistant can read broadcast history."""
    return list(_alerts)


async def create_alert(
    level: str,
    message: str,
    sent_by: str = "System",
    dedup_key: str | None = None,
) -> dict | None:
    """Create and broadcast an alert, optionally suppressing duplicates."""
    global _counter
    if dedup_key and any(alert.get("dedupKey") == dedup_key for alert in _alerts):
        return None

    _counter += 1
    alert = {
        "id": f"al-{_counter}",
        "level": level,
        "message": message,
        "sentAt": datetime.now(timezone.utc).isoformat(),
        "sentBy": sent_by,
    }
    if dedup_key:
        alert["dedupKey"] = dedup_key
    _alerts.append(alert)
    await emit_alert_new(alert)
    return alert


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
    return await create_alert(body.level, body.message)
