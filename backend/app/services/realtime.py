# app/services/realtime.py
"""
Socket.IO realtime channel shared by all routers.

The ASGI app in app/main.py serves this alongside FastAPI on one port, so the
frontend's socket.io client (frontend/lib/socket.ts) connects to the same
host it already uses for REST calls. Routers broadcast events here; the
dashboard keeps its caches fresh via frontend/hooks/useLiveUpdates.ts.
"""
import logging

import socketio

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


@sio.event
async def connect(sid, environ):
    logger.info("Realtime client connected: %s", sid)


@sio.event
async def disconnect(sid):
    logger.info("Realtime client disconnected: %s", sid)


async def emit_incident_new(incident: dict) -> None:
    """Broadcast a newly reported incident (incl. GPS coordinates) to dashboards."""
    await sio.emit("incident:new", incident)


async def emit_incident_updated(incident: dict) -> None:
    """Broadcast an incident update (status change) to dashboards."""
    await sio.emit("incident:updated", incident)


async def emit_incident_deleted(incident_id: str) -> None:
    """Broadcast a deleted incident id so dashboards drop the case everywhere."""
    await sio.emit("incident:deleted", {"id": incident_id})


async def emit_evidence_deleted(evidence_id: str) -> None:
    """Broadcast a deleted evidence id so the Live Share gallery removes the tile."""
    await sio.emit("evidence:deleted", {"id": evidence_id})


async def emit_rescue_guidance_ready(session: dict) -> None:
    """Broadcast that rescue guidance has been generated for a victim."""
    await sio.emit("rescue:guidance_ready", session)


async def emit_rescue_authority_called(data: dict) -> None:
    """Broadcast that the victim has called the emergency authority."""
    await sio.emit("rescue:authority_called", data)


async def emit_alert_new(alert: dict) -> None:
    """Broadcast a newly created manual or automated warning."""
    await sio.emit("alert:new", alert)


async def emit_weather_updated(snapshot: dict) -> None:
    """Notify dashboards that the Pakistan monitor has refreshed."""
    await sio.emit("weather:updated", {"updatedAt": snapshot.get("updatedAt")})
