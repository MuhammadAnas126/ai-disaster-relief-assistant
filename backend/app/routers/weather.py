from fastapi import APIRouter

from app.services.weather_monitor import get_weather_snapshot, refresh_weather_snapshot

router = APIRouter()


@router.get("/pakistan")
async def pakistan_weather():
    """Return the latest Pakistan weather and earthquake monitoring snapshot."""
    return get_weather_snapshot()


@router.post("/pakistan/refresh")
async def refresh_pakistan_weather():
    """Refresh monitoring data on demand for dispatch operators."""
    return await refresh_weather_snapshot()
