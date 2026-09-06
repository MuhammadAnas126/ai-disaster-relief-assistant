# app/routers/rescue.py
"""
Rescue Guidance router — provides AI-generated evacuation steps and a direct
call-authority bridge for victims in active disaster zones. Public endpoints
(no auth required) so anyone in the field can reach them without login.
"""
import hashlib
import asyncio
import json
import logging
import math
import time
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.ai_service import ai_service
from app.services.realtime import emit_rescue_guidance_ready, emit_rescue_authority_called

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------
_rescue_sessions: dict[str, dict] = {}
_counter: int = 0
_dedup_cache: dict[str, tuple[float, dict]] = {}  # hash -> (timestamp, response)

_SESSION_TTL_SECONDS = 30 * 60        # 30 minutes
_DEDUP_TTL_SECONDS = 60               # 60 seconds
_MAX_SESSIONS = 1000


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RescueGuidanceRequest(BaseModel):
    lat: float | None = None
    lng: float | None = None
    situation: str
    trapped: Literal["yes", "partial", "no"] | None = None
    disasterType: str | None = None
    language: str = "en"


class RescueStep(BaseModel):
    order: int
    instruction: str
    detail: str


class SafePoint(BaseModel):
    lat: float
    lng: float
    label: str


class RescueGuidanceResponse(BaseModel):
    sessionId: str
    steps: list[RescueStep]
    safePoint: SafePoint | None = None
    estimatedTimeMinutes: int | None = None
    warnings: list[str]
    generatedAt: str


class CallAuthorityRequest(BaseModel):
    sessionId: str | None = None
    lat: float | None = None
    lng: float | None = None
    victimName: str | None = None
    situation: str | None = None


class CallAuthorityResponse(BaseModel):
    success: bool
    authorityPhone: str
    calledAt: str
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _prune_expired_sessions() -> None:
    """Drop sessions older than the TTL."""
    now = time.time()
    expired = [
        sid for sid, s in _rescue_sessions.items()
        if now - s.get("_created_ts", 0) > _SESSION_TTL_SECONDS
    ]
    for sid in expired:
        _rescue_sessions.pop(sid, None)
    if expired:
        logger.debug("Pruned %d expired rescue sessions", len(expired))


def _prune_dedup_cache() -> None:
    """Drop dedup entries older than the TTL."""
    now = time.time()
    expired = [
        h for h, (ts, _) in _dedup_cache.items()
        if now - ts > _DEDUP_TTL_SECONDS
    ]
    for h in expired:
        _dedup_cache.pop(h, None)


def _dedup_key(body: RescueGuidanceRequest) -> str:
    """
    Build a stable hash for near-identical requests so a victim frantically
    tapping the button does not burn through AI quota.
    """
    raw = f"{body.lat}|{body.lng}|{body.situation.strip().lower()}|{body.trapped}|{body.disasterType}|{body.language}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_rescue_sessions() -> list[dict]:
    """Public accessor for other modules (admin assistant, monitor)."""
    _prune_expired_sessions()
    return [
        {k: v for k, v in s.items() if not k.startswith("_")}
        for s in _rescue_sessions.values()
    ]


def _demo_safe_point(lat: float, lng: float) -> SafePoint:
    """Return a nearby demo destination when AI has no verified safe point."""
    return SafePoint(
        lat=lat + 0.008,
        lng=lng + 0.008,
        label="Demo Safe Point",
    )


def _overpass_safe_point(lat: float, lng: float) -> SafePoint | None:
    """Find the nearest mapped emergency destination through OpenStreetMap."""
    query = f"""
    [out:json][timeout:8];
    (
      nwr["amenity"~"hospital|clinic|shelter"](around:10000,{lat},{lng});
      nwr["emergency"="ambulance_station"](around:10000,{lat},{lng});
    );
    out center tags;
    """
    request = Request(
        "https://overpass-api.de/api/interpreter?" + urlencode({"data": query}),
        headers={"User-Agent": "AI-Disaster-Relief-Assistant/1.0"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            elements = json.loads(response.read().decode("utf-8")).get("elements", [])
    except Exception as exc:
        logger.warning("OpenStreetMap safe-point lookup failed: %s", exc)
        return None

    candidates: list[tuple[int, float, SafePoint]] = []
    priorities = {"shelter": 0, "hospital": 1, "clinic": 2, "ambulance_station": 3}
    for element in elements:
        tags = element.get("tags") or {}
        element_lat = element.get("lat", (element.get("center") or {}).get("lat"))
        element_lng = element.get("lon", (element.get("center") or {}).get("lon"))
        if not isinstance(element_lat, (int, float)) or not isinstance(element_lng, (int, float)):
            continue
        category = tags.get("amenity") or tags.get("emergency")
        if category not in priorities:
            continue
        distance = math.hypot((element_lat - lat) * 111, (element_lng - lng) * 111)
        name = tags.get("name") or category.replace("_", " ").title()
        candidates.append((priorities[category], distance, SafePoint(
            lat=float(element_lat), lng=float(element_lng), label=f"{name} (OpenStreetMap)",
        )))

    if not candidates:
        return None
    candidates.sort(key=lambda candidate: (candidate[0], candidate[1]))
    return candidates[0][2]


async def _find_safe_point(lat: float, lng: float) -> SafePoint | None:
    return await asyncio.to_thread(_overpass_safe_point, lat, lng)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/guidance", response_model=RescueGuidanceResponse)
async def rescue_guidance(body: RescueGuidanceRequest):
    """
    Generate AI evacuation guidance for a victim.
    Deduplicates near-identical requests within 60 seconds to avoid
    redundant AI calls during high-stress repeated taps.
    """
    global _counter

    if not body.situation.strip():
        raise HTTPException(status_code=400, detail="Situation description is required")

    # Dedup check
    _prune_dedup_cache()
    key = _dedup_key(body)
    if key in _dedup_cache:
        _, cached = _dedup_cache[key]
        logger.info("Rescue guidance dedup hit for key %s", key[:12])
        return RescueGuidanceResponse(**cached)

    # Default coordinates when GPS unavailable (central Pakistan)
    lat = body.lat if body.lat is not None else 30.3753
    lng = body.lng if body.lng is not None else 69.3451

    result = await ai_service.generate_rescue_guidance(
        lat=lat,
        lng=lng,
        situation=body.situation,
        trapped=body.trapped,
        disaster_type=body.disasterType,
        language=body.language,
    )

    if not result.get("success"):
        logger.error("generate_rescue_guidance failed: %s", result.get("error"))
        raise HTTPException(
            status_code=502,
            detail=f"AI guidance unavailable: {result.get('error', 'unknown error')}",
        )

    guidance = result["guidance"]

    # Build session
    _prune_expired_sessions()
    if len(_rescue_sessions) >= _MAX_SESSIONS:
        # Evict oldest session
        oldest = min(_rescue_sessions, key=lambda sid: _rescue_sessions[sid].get("_created_ts", 0))
        _rescue_sessions.pop(oldest, None)

    _counter += 1
    session_id = f"rg-{_counter}"
    now_iso = datetime.now(timezone.utc).isoformat()
    now_ts = time.time()

    # Normalize steps from AI output
    raw_steps = guidance.get("steps") or []
    steps = []
    for s in raw_steps[:8]:
        if isinstance(s, dict):
            steps.append(RescueStep(
                order=int(s.get("order", len(steps) + 1)),
                instruction=str(s.get("instruction", "")),
                detail=str(s.get("detail", "")),
            ))

    # Normalize safe point
    raw_sp = guidance.get("safePoint")
    safe_point = None
    if isinstance(raw_sp, dict):
        sp_lat = raw_sp.get("lat")
        sp_lng = raw_sp.get("lng")
        sp_label = raw_sp.get("label", "Safe zone")
        if isinstance(sp_lat, (int, float)) and isinstance(sp_lng, (int, float)):
            safe_point = SafePoint(lat=float(sp_lat), lng=float(sp_lng), label=str(sp_label))

    est_time = guidance.get("estimatedTimeMinutes")
    if not isinstance(est_time, int) or est_time < 0:
        est_time = None

    raw_warnings = guidance.get("warnings") or []
    warnings = [str(w) for w in raw_warnings if isinstance(w, str)]

    # Prefer a mapped emergency destination, then keep the demo flow navigable
    # when neither AI nor OpenStreetMap can provide one.
    if safe_point is None:
        safe_point = await _find_safe_point(lat, lng)
        if safe_point:
            warnings = [
                "Destination found from OpenStreetMap. Verify that it is safe before moving.",
                *warnings,
            ]
        else:
            safe_point = _demo_safe_point(lat, lng)
            warnings = [
                "Demo destination only — verify a real shelter or evacuation center before moving.",
                *warnings,
            ]

    session_data = {
        "sessionId": session_id,
        "steps": [s.model_dump() for s in steps],
        "safePoint": safe_point.model_dump() if safe_point else None,
        "estimatedTimeMinutes": est_time,
        "warnings": warnings,
        "generatedAt": now_iso,
        "situation": body.situation,
        "trapped": body.trapped,
        "disasterType": body.disasterType,
        "lat": lat,
        "lng": lng,
        "_created_ts": now_ts,
    }

    _rescue_sessions[session_id] = session_data

    response_dict = {
        "sessionId": session_id,
        "steps": session_data["steps"],
        "safePoint": session_data["safePoint"],
        "estimatedTimeMinutes": est_time,
        "warnings": warnings,
        "generatedAt": now_iso,
    }
    _dedup_cache[key] = (now_ts, response_dict)

    # Broadcast to admin dashboards
    await emit_rescue_guidance_ready(session_data)

    return RescueGuidanceResponse(**response_dict)


@router.post("/call-authority", response_model=CallAuthorityResponse)
async def call_authority(body: CallAuthorityRequest):
    """
    Log the authority call and emit a Socket.IO notification to admin
    dashboards. Returns the authority phone number so the frontend can
    initiate a direct `tel:` call without any further backend round-trip.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    logger.warning(
        "AUTHORITY CALL | session=%s | victim=%s | lat=%s lng=%s | situation=%s",
        body.sessionId,
        body.victimName or "unknown",
        body.lat, body.lng,
        (body.situation or "")[:200],
    )

    # Emit to admin dashboards via Socket.IO
    await emit_rescue_authority_called({
        "sessionId": body.sessionId,
        "victimName": body.victimName,
        "lat": body.lat,
        "lng": body.lng,
        "situation": body.situation,
        "authorityPhone": settings.AUTHORITY_PHONE,
        "calledAt": now_iso,
    })

    return CallAuthorityResponse(
        success=True,
        authorityPhone=settings.AUTHORITY_PHONE,
        calledAt=now_iso,
        message=f"Call {settings.AUTHORITY_PHONE} now for emergency assistance.",
    )


@router.get("/sessions")
async def list_sessions():
    """Return all active (non-expired) rescue sessions."""
    _prune_expired_sessions()
    return [
        {k: v for k, v in s.items() if not k.startswith("_")}
        for s in _rescue_sessions.values()
    ]


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Return a specific rescue session by ID."""
    session = _rescue_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Rescue session not found")
    # Check expiry
    if time.time() - session.get("_created_ts", 0) > _SESSION_TTL_SECONDS:
        _rescue_sessions.pop(session_id, None)
        raise HTTPException(status_code=404, detail="Rescue session expired")
    return {k: v for k, v in session.items() if not k.startswith("_")}
