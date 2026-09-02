# app/services/evidence_store.py
"""
Gallery of victim-submitted evidence (uploaded photos/videos and live-share
stream frames).

Every record references media persisted under <LOCAL_STORAGE_DIR>/evidence/,
served by the /media static mount in app/main.py. Records also feed the Admin
AI Assistant's operations snapshot, so each one carries its Qwen-VL analysis
plus the victim's trapped status for queries like "show all cases where
people are trapped based on recent photos".

Aggregation across ALL analyzed frames (including ones without a stored
media file) remains in triage_store — this store is the per-submission view.
Replace the in-memory list with a real DB for production.
"""
import logging
import os
from datetime import datetime, timezone

from app.config import settings
from app.services.realtime import sio

logger = logging.getLogger(__name__)

MEDIA_ROOT = os.path.abspath(settings.LOCAL_STORAGE_DIR)
EVIDENCE_DIR = os.path.join(MEDIA_ROOT, "evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

# Keep only the most recent submissions — an operations window, not an archive.
MAX_EVIDENCE = 200
# Live streams send a frame every few seconds; only archive one gallery entry
# per window so continuous streaming doesn't flood the admin's Live Share view.
STREAM_EVIDENCE_INTERVAL_S = 10

_evidence: list[dict] = []
_counter = 0
_last_stream_record: datetime | None = None


def _extension(filename: str | None, content_type: str | None, default: str) -> str:
    """Best-effort file extension from the original name or MIME type."""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return ext
    if content_type and "/" in content_type:
        sub = content_type.split("/", 1)[1].split("+")[0]
        if sub.isalnum() and len(sub) <= 5:
            return sub
    return default


def _save_file(data: bytes, filename: str) -> str:
    path = os.path.join(EVIDENCE_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return f"/media/evidence/{filename}"


def _normalize_analysis(analysis: dict | None) -> dict | None:
    """Keep only the fields the UI and AI snapshot rely on; never crash."""
    if not isinstance(analysis, dict):
        return None
    hazards = analysis.get("hazards") or []
    if not isinstance(hazards, list):
        hazards = [str(hazards)]
    return {
        "status": str(analysis.get("status", "unknown")),
        "disasterType": str(analysis.get("disaster_type", analysis.get("disasterType", "unknown"))),
        "confidence": float(analysis.get("confidence", 0.0) or 0.0),
        "hazards": [str(h) for h in hazards],
    }


async def record(
    file_content: bytes,
    file_info: dict,
    *,
    source: str = "upload",
    frame_content: bytes | None = None,
    frame_ext: str = "jpg",
    analysis: dict | None = None,
    case_id: str | None = None,
    location: dict | None = None,
    trapped: str | None = None,
    people_affected: int | None = None,
    is_stream_frame: bool = False,
) -> dict | None:
    """
    Persist one evidence submission and broadcast it to dashboards.

    For videos, `frame_content` is the client-extracted poster frame used for
    both the AI analysis and the gallery thumbnail. Stream frames pass the
    JPEG itself as the media and are throttled to STREAM_EVIDENCE_INTERVAL_S.
    Returns the stored record, or None when a stream frame was throttled out.
    """
    global _counter, _last_stream_record

    now = datetime.now(timezone.utc)
    if is_stream_frame:
        if (
            _last_stream_record is not None
            and (now - _last_stream_record).total_seconds() < STREAM_EVIDENCE_INTERVAL_S
        ):
            return None
        _last_stream_record = now

    _counter += 1
    evidence_id = f"ev-{_counter}"
    media_type = "video" if str(file_info.get("contentType", "")).startswith("video/") else "image"

    ext = _extension(
        file_info.get("filename"), file_info.get("contentType"),
        "mp4" if media_type == "video" else "jpg",
    )
    media_url = _save_file(file_content, f"{evidence_id}-{media_type}.{ext}")

    thumbnail_url = None
    if frame_content:
        thumbnail_url = _save_file(frame_content, f"{evidence_id}-thumb.{frame_ext}")
    elif media_type == "image":
        # Image uploads without a separate frame use the media itself as thumb.
        thumbnail_url = media_url

    record_dict = {
        "id": evidence_id,
        "mediaType": media_type,
        "mediaUrl": media_url,
        "thumbnailUrl": thumbnail_url,
        "source": "stream" if is_stream_frame else source,
        "caseId": case_id,
        "location": location,
        "trapped": trapped,
        "peopleAffected": people_affected,
        "analysis": _normalize_analysis(analysis),
        "receivedAt": now.isoformat(),
    }
    _evidence.append(record_dict)
    if len(_evidence) > MAX_EVIDENCE:
        del _evidence[: len(_evidence) - MAX_EVIDENCE]

    await sio.emit("evidence:new", record_dict)
    logger.info(
        "Evidence recorded: %s (%s, %s) analysis=%s",
        evidence_id, media_type, record_dict["source"],
        bool(record_dict["analysis"]),
    )
    return record_dict


def list_evidence() -> list[dict]:
    """Return all evidence records, newest first."""
    return sorted(_evidence, key=lambda e: e["receivedAt"], reverse=True)


def get_evidence(evidence_id: str) -> dict | None:
    for e in _evidence:
        if e["id"] == evidence_id:
            return e
    return None


async def link_to_case(case_id: str, evidence_ids: list[str]) -> list[str]:
    """Attach evidence submitted before the SOS to its incident; returns linked ids."""
    linked = []
    for e in _evidence:
        if e["id"] in evidence_ids:
            e["caseId"] = case_id
            linked.append(e["id"])
    if linked:
        await sio.emit("evidence:updated", {"caseId": case_id, "evidenceIds": linked})
    return linked


async def unlink_from_case(case_id: str) -> list[str]:
    """Detach evidence from a deleted case so the gallery keeps no dangling ids."""
    unlinked = []
    for e in _evidence:
        if e.get("caseId") == case_id:
            e["caseId"] = None
            unlinked.append(e["id"])
    if unlinked:
        await sio.emit("evidence:updated", {"caseId": None, "evidenceIds": unlinked})
    return unlinked


def aggregate() -> dict:
    """
    Compact stats over evidence submissions (per-submission view; triage_store
    holds the per-frame aggregation across every analyzed image).
    """
    disaster_types: dict[str, int] = {}
    victim_status: dict[str, int] = {}
    trapped_seen = 0
    for e in _evidence:
        a = e.get("analysis")
        if a:
            disaster_types[a["disasterType"]] = disaster_types.get(a["disasterType"], 0) + 1
            victim_status[a["status"]] = victim_status.get(a["status"], 0) + 1
        if e.get("trapped") in ("yes", "partial"):
            trapped_seen += 1
    return {
        "total": len(_evidence),
        "uploads": sum(1 for e in _evidence if e["source"] == "upload"),
        "streamFrames": sum(1 for e in _evidence if e["source"] == "stream"),
        "disasterTypes": disaster_types,
        "victimStatus": victim_status,
        "trappedSubmissions": trapped_seen,
        "latestReceivedAt": _evidence[-1]["receivedAt"] if _evidence else None,
    }
