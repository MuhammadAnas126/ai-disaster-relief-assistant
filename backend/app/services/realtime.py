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
