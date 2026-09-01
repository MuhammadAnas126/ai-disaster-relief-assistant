# app/routers/incidents.py
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services import evidence_store
from app.services.realtime import emit_incident_new, emit_incident_updated

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store (replace with DB for production)
_incidents: dict[str, dict] = {}
_counter = 0


def get_incidents() -> list[dict]:
    """Public accessor so the Admin AI Assistant can read the in-memory store."""
    return list(_incidents.values())


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
    """Return all incidents."""
    return list(_incidents.values())


@router.post("")
async def create_incident(body: IncidentCreate):
    """Create a new incident report."""
    global _counter
    _counter += 1
    inc_id = f"inc-{_counter}"
    now = datetime.now(timezone.utc).isoformat()

    # Simple severity classification
    score = body.severityScore
    if score >= 70:
        level = "critical"
    elif score >= 40:
        level = "high"
    else:
        level = "medium"

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
        "location": body.location or {"lat": 24.8607, "lng": 67.0011, "label": "Unknown"},
        "reportedAt": now,
        "reportedBy": "Guest report" if body.isGuestReport else "Staff report",
        "isGuestReport": body.isGuestReport,
    }
    _incidents[inc_id] = incident
    # Attach evidence (photos/videos/live-share frames) the victim submitted
    # before sending the SOS so admins can jump from case to media and back.
    if body.evidenceIds:
        incident["evidenceIds"] = await evidence_store.link_to_case(inc_id, body.evidenceIds)
    # Push the new report (incl. GPS coordinates) to dashboards in real time.
    await emit_incident_new(incident)
    return incident


@router.patch("/{incident_id}")
async def update_incident(incident_id: str, body: IncidentUpdate):
    """Update an incident's status."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")
    _incidents[incident_id]["status"] = body.status
    await emit_incident_updated(_incidents[incident_id])
    return _incidents[incident_id]


@router.post("/analyze")
async def analyze_incident(body: dict):
    """Placeholder for AI-powered incident analysis."""
    return {
        "peopleAffected": 0,
        "trapped": "no",
        "structuralDamage": "minor",
        "severityScore": 0,
        "reasoning": "AI analysis endpoint — connect DashScope for live estimates.",
    }
