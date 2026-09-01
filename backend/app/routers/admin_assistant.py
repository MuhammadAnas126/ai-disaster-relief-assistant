# app/routers/admin_assistant.py
"""
Admin AI Assistant — a Qwen-Max co-pilot for dispatch administrators.

Unlike the victim-facing chatbot, this endpoint grounds every answer in a
live operations snapshot built from:
- the in-memory incident store (incoming victim SOS reports),
- the broadcast alert history,
- aggregated Qwen-VL visual triage findings from live-share photos.

When the admin asks the AI to draft a broadcast, the response carries a
ready-to-review {level, message} draft the frontend loads into the
Broadcast Alert form.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.routers.alerts import get_alerts
from app.routers.auth import _get_current_user
from app.routers.incidents import get_incidents
from app.services import evidence_store, triage_store
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Most-recent items embedded in the prompt snapshot (keeps tokens bounded).
MAX_RECENT_INCIDENTS = 20
MAX_RECENT_ALERTS = 10
MAX_RECENT_EVIDENCE = 15
# Rolling windows (minutes) pre-computed for time-based questions such as
# "How many critical SOS alerts came in during the last 20 minutes?"
SNAPSHOT_WINDOWS_MIN = (15, 30, 60, 24 * 60)


class AdminChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None
    context: dict | None = None


class BroadcastDraft(BaseModel):
    level: str
    message: str


class AdminChatResponse(BaseModel):
    reply: str
    broadcast: BroadcastDraft | None = None


def _within_minutes(iso_timestamp: str | None, minutes: float, now: datetime) -> bool:
    """True when an ISO timestamp falls inside the last `minutes` window."""
    if not iso_timestamp:
        return False
    try:
        ts = datetime.fromisoformat(iso_timestamp)
    except (TypeError, ValueError):
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return now - ts <= timedelta(minutes=minutes)


def _build_snapshot() -> dict:
    """Compose the live operations snapshot the assistant is grounded in."""
    now = datetime.now(timezone.utc)
    incidents = get_incidents()
    alerts = get_alerts()

    severity = {"critical": 0, "high": 0, "medium": 0}
    trapped = {"yes": 0, "partial": 0, "no": 0}
    status_counts = {"open": 0, "in_progress": 0, "resolved": 0}
    people_affected = 0
    for inc in incidents:
        if inc.get("severityLevel") in severity:
            severity[inc["severityLevel"]] += 1
        if inc.get("trapped") in trapped:
            trapped[inc["trapped"]] += 1
        if inc.get("status") in status_counts:
            status_counts[inc["status"]] += 1
        people_affected += inc.get("peopleAffected", 0) or 0

    rolling_windows = {}
    for minutes in SNAPSHOT_WINDOWS_MIN:
        in_window = [
            i for i in incidents if _within_minutes(i.get("reportedAt"), minutes, now)
        ]
        rolling_windows[f"last_{minutes}m"] = {
            "total": len(in_window),
            "critical": sum(1 for i in in_window if i.get("severityLevel") == "critical"),
            "trapped": sum(1 for i in in_window if i.get("trapped") in ("yes", "partial")),
        }

    recent = [
        {
            "id": i.get("id"),
            "title": i.get("title"),
            "description": str(i.get("description", ""))[:200],
            "severityLevel": i.get("severityLevel"),
            "severityScore": i.get("severityScore"),
            "trapped": i.get("trapped"),
            "peopleAffected": i.get("peopleAffected"),
            "structuralDamage": i.get("structuralDamage"),
            "status": i.get("status"),
            "location": (i.get("location") or {}).get("label"),
            "reportedAt": i.get("reportedAt"),
            "reportedBy": i.get("reportedBy"),
        }
        for i in sorted(incidents, key=lambda i: i.get("reportedAt", ""), reverse=True)[
            :MAX_RECENT_INCIDENTS
        ]
    ]

    recent_alerts = [
        {
            "id": a.get("id"),
            "level": a.get("level"),
            "message": str(a.get("message", ""))[:150],
            "sentAt": a.get("sentAt"),
        }
        for a in sorted(alerts, key=lambda a: a.get("sentAt", ""), reverse=True)[
            :MAX_RECENT_ALERTS
        ]
    ]

    recent_evidence = []
    for e in evidence_store.list_evidence()[:MAX_RECENT_EVIDENCE]:
        analysis = e.get("analysis") or {}
        recent_evidence.append(
            {
                "id": e["id"],
                "mediaType": e["mediaType"],
                "source": e["source"],
                "caseId": e.get("caseId"),
                "trapped": e.get("trapped"),
                "peopleAffected": e.get("peopleAffected"),
                "disasterType": analysis.get("disasterType"),
                "victimStatus": analysis.get("status"),
                "hazards": analysis.get("hazards", []),
                "location": (e.get("location") or {}).get("label"),
                "receivedAt": e["receivedAt"],
            }
        )

    return {
        "generatedAt": now.isoformat(),
        "incidents": {
            "total": len(incidents),
            "bySeverity": severity,
            "byTrapped": trapped,
            "byStatus": status_counts,
            "peopleAffectedTotal": people_affected,
            "rollingWindows": rolling_windows,
            "recent": recent,
        },
        "broadcastAlertsSent": {
            "total": len(alerts),
            "recent": recent_alerts,
        },
        "visualTriage": triage_store.aggregate(),
        "visualEvidence": {
            "stats": evidence_store.aggregate(),
            "recent": recent_evidence,
        },
    }


def _offline_summary(snapshot: dict) -> str:
    """Deterministic snapshot digest returned when the AI call fails."""
    incidents = snapshot["incidents"]
    triage = snapshot["visualTriage"]
    evidence = snapshot["visualEvidence"]["stats"]
    last_30m = incidents["rollingWindows"].get("last_30m", {})

    lines = [
        "I can't reach the operations AI right now, but here is the live snapshot:",
        f"- SOS cases: {incidents['total']} total, "
        f"{incidents['byStatus'].get('open', 0)} open, "
        f"{incidents['bySeverity'].get('critical', 0)} critical, "
        f"{incidents['byTrapped'].get('yes', 0)} fully trapped "
        f"({incidents['byTrapped'].get('partial', 0)} partial).",
        f"- People affected so far: {incidents['peopleAffectedTotal']}.",
        f"- Last 30 minutes: {last_30m.get('total', 0)} new reports, "
        f"{last_30m.get('critical', 0)} critical.",
    ]

    if triage["totalFrames"]:
        top_type = max(triage["disasterTypes"].items(), key=lambda kv: kv[1])
        lines.append(
            f"- Live-share photos: {triage['totalFrames']} analyzed; most common "
            f"disaster type: {top_type[0]} ({top_type[1]} frames)."
        )
    else:
        lines.append("- Live-share photos: none analyzed yet.")

    if evidence["total"]:
        lines.append(
            f"- Evidence submissions: {evidence['total']} total "
            f"({evidence['uploads']} uploads, {evidence['streamFrames']} live-stream "
            f"frames), {evidence['trappedSubmissions']} from trapped victims."
        )

    lines.append(
        "Try again in a moment for full analysis, summaries, and broadcast drafting."
    )
    return "\n".join(lines)


@router.post("/message", response_model=AdminChatResponse)
async def admin_chat_message(
    body: AdminChatRequest, user: dict = Depends(_get_current_user)
):
    """
    Send a message to the Admin AI Assistant (Qwen-Max), grounded in live
    operations data: victim SOS reports, broadcast alert history, and
    aggregated Qwen-VL findings from live-share photos. When the admin asks
    for a broadcast, the response carries a ready-to-review draft for the
    Broadcast Alert form.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    snapshot = _build_snapshot()

    try:
        result = await ai_service.admin_chat(
            body.message, snapshot, body.history, body.context
        )
        if result.get("success"):
            return AdminChatResponse(
                reply=result["reply"], broadcast=result.get("broadcast")
            )
        logger.error("Admin assistant AI call failed: %s", result.get("error"))
    except Exception:
        logger.exception("Admin assistant error")

    return AdminChatResponse(reply=_offline_summary(snapshot))
