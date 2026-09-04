# app/routers/admin_assistant.py
"""
Admin AI Assistant — a Qwen-Max co-pilot for dispatch administrators.

Grounded in a live operations snapshot built from:
- the incident store (incoming victim SOS reports),
- the broadcast alert history,
- aggregated Qwen-VL visual triage findings.
"""
import logging
import re
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

MAX_RECENT_INCIDENTS = 20
MAX_RECENT_ALERTS = 10
MAX_RECENT_EVIDENCE = 15
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
    """Compose a comprehensive live operations snapshot for full system access."""
    now = datetime.now(timezone.utc)
    
    # 1. Fetch Incidents with Sanitized Locations
    raw_incidents = get_incidents()
    incidents = []
    for i in raw_incidents:
        loc = i.get("location") or {}
        lat = loc.get("lat", 31.5204)
        lng = loc.get("lng", 74.3587)
        label = loc.get("label") or ""
        
        # Sanitize generic technical placeholder strings
        if not label or label.strip().lower() in ("reported location", "unknown"):
            label = f"Verified GPS Area ({lat:.4f}, {lng:.4f})"

        incidents.append({
            "id": i.get("id"),
            "title": i.get("title"),
            "description": str(i.get("description", "")),
            "severityLevel": i.get("severityLevel"),
            "severityScore": i.get("severityScore"),
            "trapped": i.get("trapped"),
            "peopleAffected": i.get("peopleAffected"),
            "structuralDamage": i.get("structuralDamage"),
            "status": i.get("status"),
            "location": {"lat": lat, "lng": lng, "label": label},
            "reportedAt": i.get("reportedAt"),
            "reportedBy": i.get("reportedBy"),
            "isGuestReport": i.get("isGuestReport"),
            "evidenceIds": i.get("evidenceIds", []),
        })

    # 2. Fetch All Broadcast Alerts
    alerts = get_alerts()

    # 3. Fetch Full Evidence Gallery
    all_evidence = []
    for e in evidence_store.list_evidence():
        analysis = e.get("analysis") or {}
        all_evidence.append({
            "id": e["id"],
            "mediaType": e["mediaType"],
            "source": e["source"],
            "caseId": e.get("caseId"),
            "trapped": e.get("trapped"),
            "peopleAffected": e.get("peopleAffected"),
            "disasterType": analysis.get("disasterType"),
            "victimStatus": analysis.get("status"),
            "confidence": analysis.get("confidence"),
            "hazards": analysis.get("hazards", []),
            "location": e.get("location") or {},
            "receivedAt": e["receivedAt"],
        })

    return {
        "generatedAt": now.isoformat(),
        "incidents": {
            "total": len(incidents),
            "all_records": incidents,
        },
        "broadcastAlerts": {
            "total": len(alerts),
            "all_records": alerts,
        },
        "visualTriage": triage_store.aggregate(),
        "evidenceGallery": {
            "stats": evidence_store.aggregate(),
            "all_records": all_evidence,
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


def _location_answer(snapshot: dict, message: str) -> str | None:
    """Answer direct location questions from stored incident coordinates."""
    lowered = message.lower()
    if not re.search(r"\b(where|location|coordinate|coordinates|gps|lat|lng|longitude|latitude)\b", lowered):
        return None

    incidents = snapshot.get("incidents", {}).get("recent", [])
    candidates = []
    stop_words = {
        "the", "and", "with", "from", "near", "city", "area", "in", "at", "of",
        "high", "low", "medium", "urgent", "incident", "case",
    }
    for incident in incidents:
        title = str(incident.get("title") or "")
        keywords = [
            word for word in re.findall(r"[a-z0-9]+", title.lower())
            if len(word) > 2 and word not in stop_words
        ]
        overlap = sum(1 for keyword in keywords if keyword in lowered)
        if overlap:
            candidates.append((overlap, incident))
    matches = [
        incident for _, incident in sorted(candidates, key=lambda item: item[0], reverse=True)
    ]
    if not matches:
        asks_for_all = not re.search(
            r"\b(forest|fire|flood|earthquake|sandstorm|storm|landslide|collapse|incident|case)\b",
            lowered,
        )
        if asks_for_all:
            matches = incidents
    if not matches:
        return None

    lines = []
    for incident in matches:
        location = incident.get("location") or {}
        lat = location.get("lat")
        lng = location.get("lng")
        label = location.get("label") or ""

        # SANITIZATION: Clean generic/technical placeholders
        if not label or label.strip().lower() in ("reported location", "unknown", ""):
            if lat is not None and lng is not None:
                label = f"Verified GPS Area ({lat:.4f}, {lng:.4f})"
            else:
                label = "Location verification pending (Default Region)"

        if lat is not None and lng is not None:
            lines.append(f"{incident.get('title')}: {label} (Coordinates: {lat:.4f}, {lng:.4f})")
        else:
            lines.append(f"{incident.get('title')}: {label}")
            
    return "\n".join(lines)


@router.post("/message", response_model=AdminChatResponse)
async def admin_chat_message(
    body: AdminChatRequest, user: dict = Depends(_get_current_user)
):
    """
    Send a message to the Admin AI Assistant (Qwen-Max), grounded in live
    operations data.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    snapshot = _build_snapshot()

    direct_location = _location_answer(snapshot, body.message)
    if direct_location:
        return AdminChatResponse(reply=direct_location)

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