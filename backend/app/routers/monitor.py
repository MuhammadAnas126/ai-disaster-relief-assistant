# app/routers/monitor.py
import base64
import logging
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings
from app.schemas import Alert, AnalyzeResponse, ImageUrlRequest, TranscriptRequest
from app.services.ai_service import AIService
from app.services.storage_service import StorageError, storage_service

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory alert buffer (newest first). Swap for Redis/DB in production.
MAX_ALERTS = 500
_recent_alerts: deque = deque(maxlen=MAX_ALERTS)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_visual_alert(analysis: dict, image_url: Optional[str], source: Optional[str]) -> Optional[Alert]:
    """Create an alert when the vision analysis indicates a person needing rescue."""
    status = (analysis.get("status") or "").lower()
    hazards = analysis.get("hazards") or []

    if status == "collapsed":
        severity = "critical"
    elif status == "sitting" and hazards:
        severity = "medium"
    else:
        return None

    alert = Alert(
        alert_id=str(uuid.uuid4()),
        alert_type="visual",
        severity=severity,
        requires_rescue=True,
        details={"status": status, "confidence": analysis.get("confidence"), "hazards": hazards},
        image_url=image_url,
        source=source,
        timestamp=_now_iso(),
    )
    _recent_alerts.appendleft(alert)
    return alert


def _build_audio_alert(analysis: dict, source: Optional[str]) -> Optional[Alert]:
    """Create an alert when the transcript indicates distress."""
    if not analysis.get("is_distress"):
        return None

    severity = (analysis.get("severity") or "medium").lower()
    if severity == "none":
        severity = "medium"

    alert = Alert(
        alert_id=str(uuid.uuid4()),
        alert_type="audio",
        severity=severity,
        requires_rescue=True,
        details={
            "reason": analysis.get("reason"),
            "confidence": analysis.get("confidence"),
        },
        source=source,
        timestamp=_now_iso(),
    )
    _recent_alerts.appendleft(alert)
    return alert


async def _analyze_image_url(
    image_ref: str,
    source: Optional[str],
    storage_meta: Optional[dict] = None,
    display_url: Optional[str] = None,
) -> AnalyzeResponse:
    result = await AIService.analyze_victim_image(image_ref)

    if not result["success"]:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {result['error']}")

    analysis = result["data"]
    alert = _build_visual_alert(analysis, display_url, source)

    return AnalyzeResponse(
        success=True,
        requires_rescue=alert is not None,
        alert=alert,
        analysis=analysis,
        storage=storage_meta,
    )


@router.get("/health")
async def health():
    """Liveness probe and configuration status."""
    return {
        "status": "ok",
        "ai_configured": bool(settings.DASHSCOPE_API_KEY),
        "storage_backend": "oss" if storage_service._bucket else "local",
    }


@router.post("/analyze-frame", response_model=AnalyzeResponse)
async def analyze_frame(file: UploadFile = File(...), source: Optional[str] = None):
    """
    Upload a camera frame. The frame is persisted to storage and analyzed
    by Qwen-VL for collapsed victims / hazards.
    """
    try:
        file_bytes = await file.read()
        storage_meta = storage_service.save_image(file_bytes, file.filename)
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Storage failure")
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")

    if storage_meta["backend"] == "oss":
        image_ref = storage_meta["url"]
    else:
        # No public URL available; pass the frame to Qwen-VL as a base64 data URL
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        content_type = file.content_type or "image/jpeg"
        image_ref = f"data:{content_type};base64,{b64}"

    return await _analyze_image_url(image_ref, source, storage_meta, display_url=storage_meta["url"])


@router.post("/analyze-frame-url", response_model=AnalyzeResponse)
async def analyze_frame_url(request: ImageUrlRequest):
    """Analyze an already-hosted image URL (e.g. RTSP snapshot pushed to OSS by the camera)."""
    return await _analyze_image_url(request.image_url, source=None, display_url=request.image_url)


@router.post("/analyze-transcript", response_model=AnalyzeResponse)
async def analyze_transcript(request: TranscriptRequest):
    """
    Analyze an audio transcript (e.g. produced by Paraformer ASR) for
    signs of human distress using Qwen-Max.
    """
    result = await AIService.analyze_audio_transcript(request.transcript)

    if not result["success"]:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {result['error']}")

    analysis = result["data"]
    alert = _build_audio_alert(analysis, request.source)

    return AnalyzeResponse(
        success=True,
        requires_rescue=alert is not None,
        alert=alert,
        analysis=analysis,
    )


@router.get("/alerts", response_model=list[Alert])
async def list_alerts(limit: int = 50, alert_type: Optional[str] = None):
    """Return the most recent rescue alerts, newest first."""
    alerts = list(_recent_alerts)
    if alert_type:
        alerts = [a for a in alerts if a.alert_type == alert_type]
    return alerts[: max(1, min(limit, MAX_ALERTS))]
