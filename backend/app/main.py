# app/main.py
import logging
import asyncio

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import monitor, chatbot, livestream, auth, incidents, checkins, alerts, admin_assistant, evidence, rescue, weather
from app.services.realtime import sio
from app.services.evidence_store import MEDIA_ROOT
from app.services.weather_monitor import weather_monitor_loop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

fastapi_app = FastAPI(
    title="Sentinel AI Backend",
    description="Real-time multimodal disaster relief monitoring system",
    version="0.1.0"
)

_weather_task: asyncio.Task | None = None


@fastapi_app.on_event("startup")
async def start_weather_monitor() -> None:
    global _weather_task
    _weather_task = asyncio.create_task(weather_monitor_loop())


@fastapi_app.on_event("shutdown")
async def stop_weather_monitor() -> None:
    if _weather_task:
        _weather_task.cancel()

# CORS (frontend will typically run on a separate origin)
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers — all under /api to match the frontend API_BASE_URL
fastapi_app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
fastapi_app.include_router(monitor.router, prefix="/api/monitor", tags=["Monitoring"])
fastapi_app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])
fastapi_app.include_router(livestream.router, prefix="/api/livestream", tags=["Livestream"])
fastapi_app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
fastapi_app.include_router(checkins.router, prefix="/api/check-ins", tags=["Check-ins"])
fastapi_app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
fastapi_app.include_router(admin_assistant.router, prefix="/api/admin-assistant", tags=["Admin Assistant"])
fastapi_app.include_router(evidence.router, prefix="/api/evidence", tags=["Evidence"])
fastapi_app.include_router(rescue.router, prefix="/api/rescue", tags=["Rescue"])
fastapi_app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])

# Serve persisted evidence media (photos, video poster frames, stream frames)
# so the admin Live Share gallery can preview victim submissions.
fastapi_app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")

@fastapi_app.get("/")
async def root():
    return {"message": "Sentinel AI is online. Ready to save lives."}


# Serve Socket.IO and FastAPI on one port: /socket.io/* requests go to the
# realtime server (consumed by frontend/hooks/useLiveUpdates.ts), everything
# else to the FastAPI app. Uvicorn keeps targeting `app.main:app`.
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)