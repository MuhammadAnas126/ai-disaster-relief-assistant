# app/routers/incidents.py
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.routers.auth import _get_current_user
from app.database import get_connection
from app.services.ai_service import ai_service
from app.services import evidence_store
from app.services.realtime import emit_incident_new, emit_incident_updated, emit_incident_deleted

logger = logging.getLogger(__name__)

router = APIRouter()

# City fallback map for missing or unparsed coordinates
CITY_COORDINATES = {
    "islamabad": (33.7438, 73.0228),
    "lahore": (31.5204, 74.3587),
    "karachi": (24.8607, 67.0011),
    "peshawar": (34.0151, 71.5249),
    "quetta": (30.1798, 66.9750),
    "multan": (30.1575, 71.5249),
    "rawalpindi": (33.5651, 73.0169),
}

def _get_fallback_coords(label: str) -> tuple[float, float]:
    """Map city names inside a location label to accurate regional coordinates."""
    lowered = label.lower()
    for city, coords in CITY_COORDINATES.items():
        if city in lowered:
            return coords
    return (31.5204, 74.3587)  # General fallback (Lahore)

def _row_to_incident(row) -> dict:
    label = row["location"] or ""
    
    # Clean generic placeholders
    if not label or label.strip().lower() in ("reported location", "unknown"):
        label = "Verified Location Pending"

    # Extract coordinates or map dynamically from city name
    coordinates = str(row["coordinates"] or "").split(",")
    try:
        lat, lng = float(coordinates[0]), float(coordinates[1])
    except (IndexError, ValueError):
        lat, lng = _get_fallback_coords(label)

    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "peopleAffected": row["affected"],
        "trapped": row["trapped"],
        "structuralDamage": row["damage"],
        "severityScore": row["ai_score"],
        "severityLevel": row["severity_level"],
        "status": row["status"],
        "location": {"lat": lat, "lng": lng, "label": label},
        "reportedAt": row["created_at"],
        "reportedBy": row["reported_by"],
        "isGuestReport": bool(row["is_guest_report"]),
        "evidenceIds": json.loads(row["evidence_ids"] or "[]"),
    }

def get_incidents() -> list[dict]:
    """Public accessor so the Admin AI Assistant reads persisted incidents."""
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM incidents ORDER BY created_at DESC").fetchall()
    return [_row_to_incident(row) for row in rows]

class IncidentCreate(BaseModel):
    title: str = "New incident"
    description: str = ""
    peopleAffected: int = 0
    trapped: str = "no"
    structuralDamage: str = "minor"
    severityScore: int = 10
    location: Optional[dict] = None
    isGuestReport: bool = False
    evidenceIds: Optional[list[str]] = None

class IncidentUpdate(BaseModel):
    status: str

@router.get("")
async def list_incidents():
    return get_incidents()

@router.post("/priority-scores")
async def score_incident_priorities(body: dict):
    incidents = body.get("incidents", [])
    if not isinstance(incidents, list):
        return {"scores": {}}
    return {"scores": await ai_service.score_incidents(incidents)}

@router.post("")
async def create_incident(body: IncidentCreate):
    with get_connection() as connection:
        next_id = connection.execute("SELECT COALESCE(MAX(CAST(SUBSTR(id, 5) AS INTEGER)), 0) + 1 FROM incidents").fetchone()[0]
    inc_id = f"inc-{next_id}"
    now = datetime.now(timezone.utc).isoformat()

    score = body.severityScore
    level = "critical" if score >= 70 else "high" if score >= 40 else "medium"

    loc_data = body.location or {}
    label = loc_data.get("label", "Verified Location Pending")
    lat = loc_data.get("lat")
    lng = loc_data.get("lng")
    if lat is None or lng is None:
        lat, lng = _get_fallback_coords(label)

    incident = {
        "id": inc_id,
        "title": body.title,
        "description": body.description,
        "peopleAffected": body.peopleAffected,
        "trapped": body.trapped,
        "structuralDamage": body.structuralDamage,
        "severityScore": body.severityScore,
        "severityLevel": level,
        "status": "open",
        "location": {"lat": lat, "lng": lng, "label": label},
        "reportedAt": now,
        "reportedBy": "Guest report" if body.isGuestReport else "Staff report",
        "isGuestReport": body.isGuestReport,
    }

    with get_connection() as connection:
        connection.execute(
            """INSERT INTO incidents
            (id, title, location, coordinates, affected, trapped, damage, ai_score, created_at,
             description, severity_level, status, reported_by, is_guest_report, evidence_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (inc_id, body.title, label, f"{lat}, {lng}",
             body.peopleAffected, body.trapped, body.structuralDamage, body.severityScore, now,
             body.description, level, "open", incident["reportedBy"], int(body.isGuestReport), "[]"),
        )

    incident = get_incident(inc_id)
    if body.evidenceIds:
        incident["evidenceIds"] = await evidence_store.link_to_case(inc_id, body.evidenceIds)
    await emit_incident_new(incident)
    return incident

@router.patch("/{incident_id}")
async def update_incident(incident_id: str, body: IncidentUpdate):
    incident = get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    with get_connection() as connection:
        connection.execute("UPDATE incidents SET status = ? WHERE id = ?", (body.status, incident_id))
    incident = get_incident(incident_id)
    await emit_incident_updated(incident)
    return incident

@router.delete("/{incident_id}")
async def delete_incident(incident_id: str, user: dict = Depends(_get_current_user)):
    if get_incident(incident_id) is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    with get_connection() as connection:
        connection.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
    unlinked = await evidence_store.unlink_from_case(incident_id)
    logger.info("Incident %s deleted by %s (evidence unlinked: %d)", incident_id, user.get("email"), len(unlinked))
    await emit_incident_deleted(incident_id)
    return {"id": incident_id, "status": "deleted"}

def get_incident(incident_id: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    return _row_to_incident(row) if row else None