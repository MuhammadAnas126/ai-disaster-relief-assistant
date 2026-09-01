# app/routers/evidence.py
"""
Unified evidence submission endpoints for the Register Your Case module.

Victims either upload static photos/videos or stream live camera frames (the
stream path lives in the livestream WebSocket). Every submission is:

1. persisted to local storage (served under /media),
2. analyzed by Qwen-VL (victim status, disaster type, hazards),
3. recorded in the evidence gallery and pushed to admin dashboards in real
   time, and
4. reflected in the Admin AI Assistant's operations snapshot.

Uploads are public — "Register Your Case" never requires an account.
"""
import base64
import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing import Optional

from app.services import triage_store
from app.services.ai_service import ai_service
from app.services import evidence_store

logger = logging.getLogger(__name__)

router = APIRouter()

# Cap the analysis input so oversized originals don't blow up the AI call —
# the client sends a downscaled JPEG frame alongside the original file.
MAX_ANALYSIS_BYTES = 8 * 1024 * 1024


def _parse_location(raw: Optional[str]) -> Optional[dict]:
    """Parse the JSON location payload sent as a multipart form field."""
    if not raw:
        return None
    try:
        loc = json.loads(raw)
        return loc if isinstance(loc, dict) else None
    except json.JSONDecodeError:
        return None


@router.post("/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    frame: Optional[UploadFile] = File(None),
    source: str = Form("upload"),
    caseId: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    trapped: Optional[str] = Form(None),
    peopleAffected: Optional[int] = Form(None),
):
    """
    Submit one piece of evidence (photo or video) for AI analysis.

    - `file`: the original media, stored for admin preview.
    - `frame`: optional JPEG the client extracted (downscaled image or video
      poster). Used for the Qwen-VL analysis and as the gallery thumbnail.
      When omitted for images, the original image itself is analyzed.

    Returns the stored evidence record including the AI analysis, so the
    victim immediately sees their submission was received and understood.
    """
    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="Empty file")

    media_type = "video" if (file.content_type or "").startswith("video/") else "image"

    # Pick the analysis input: the client-extracted frame when present,
    # otherwise the media itself (images only — raw videos aren't analyzable).
    analysis_content = None
    if frame is not None:
        analysis_content = await frame.read()
        if not analysis_content:
            analysis_content = None

    analysis_input = analysis_content
    if analysis_input is None and media_type == "image":
        analysis_input = file_content

    if analysis_input is not None and len(analysis_input) > MAX_ANALYSIS_BYTES:
        raise HTTPException(status_code=413, detail="Media too large for analysis")

    analysis = None
    if analysis_input is not None:
        image_b64 = base64.b64encode(analysis_input).decode("utf-8")
        result = await ai_service.analyze_victim_image(image_b64)
        if result.get("success") and isinstance(result.get("data"), dict):
            analysis = result["data"]
            # Feed the per-frame aggregation the Admin AI Assistant reports on.
            triage_store.record_finding(analysis)
        else:
            logger.error("Evidence AI analysis failed: %s", result.get("error"))

    record = await evidence_store.record(
        file_content,
        {"filename": file.filename, "contentType": file.content_type},
        source=source if source in ("upload", "stream") else "upload",
        frame_content=analysis_content,
        analysis=analysis,
        case_id=caseId,
        location=_parse_location(location),
        trapped=trapped,
        people_affected=peopleAffected,
    )
    return record


@router.get("")
async def list_evidence():
    """Return all evidence submissions, newest first (admin Live Share gallery)."""
    return evidence_store.list_evidence()


@router.get("/{evidence_id}")
async def get_evidence(evidence_id: str):
    """Return a single evidence submission."""
    record = evidence_store.get_evidence(evidence_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return record
