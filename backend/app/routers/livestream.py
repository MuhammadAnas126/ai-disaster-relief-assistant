# app/routers/livestream.py
import json
import logging
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import evidence_store, triage_store
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/analyze")
async def livestream_analyze(ws: WebSocket):
    """
    WebSocket endpoint for real-time camera frame analysis during Live Share.

    Protocol:
    - Client sends binary JPEG frames (or base64-encoded JSON strings),
      optionally with a JSON metadata payload (trapped status, location, case id).
    - Server analyzes each frame with Qwen-VL, sends back JSON results, and
      archives frames into the evidence gallery (throttled) so admins see the
      live stream in the Live Share section.
    """
    await ws.accept()
    logger.info("Livestream WebSocket connection opened")

    try:
        while True:
            data = await ws.receive()

            frame_bytes = None
            metadata: dict = {}

            # Handle binary frame data
            if "bytes" in data and data["bytes"]:
                frame_bytes = data["bytes"]
            # Handle text (base64 string or JSON with base64 image + metadata)
            elif "text" in data and data["text"]:
                raw = data["text"]
                try:
                    parsed = json.loads(raw)
                    image_base64 = parsed.get("image", raw)
                    metadata = parsed.get("metadata") or {}
                    frame_bytes = base64.b64decode(image_base64)
                except (json.JSONDecodeError, ValueError):
                    image_base64 = raw
                    frame_bytes = None
            else:
                continue

            if frame_bytes is None and not ("text" in data and data.get("text")):
                continue

            image_base64 = base64.b64encode(frame_bytes).decode("utf-8") if frame_bytes else image_base64

            # Analyze the frame
            result = await ai_service.analyze_victim_image(image_base64)

            # Archive successful findings so the Admin AI Assistant can
            # aggregate visual triage across all victim submissions.
            if result.get("success") and isinstance(result.get("data"), dict):
                triage_store.record_finding(result["data"])

                # Archive the frame itself as evidence (throttled) so it
                # appears in the admin Live Share gallery.
                if frame_bytes:
                    record = await evidence_store.record(
                        frame_bytes,
                        {"filename": "frame.jpg", "contentType": "image/jpeg"},
                        analysis=result["data"],
                        case_id=metadata.get("caseId"),
                        location=metadata.get("location"),
                        trapped=metadata.get("trapped"),
                        people_affected=metadata.get("peopleAffected"),
                        is_stream_frame=True,
                    )
                    if record:
                        result["evidence_id"] = record["id"]

            # Send result back to client
            await ws.send_json(result)

    except WebSocketDisconnect:
        logger.info("Livestream WebSocket connection closed")
    except Exception as e:
        logger.exception("Livestream WebSocket error")
        try:
            await ws.send_json({"success": False, "error": str(e)})
        except Exception:
            pass
