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
import json
import os
from datetime import datetime, timezone

from app.config import settings
from app.database import get_connection
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


def _row_to_record(row) -> dict:
    """Convert a SQLite row back to the evidence shape consumed by the API."""
    analysis = None
    if row["disaster_type"] or row["victim_status"]:
        try:
            hazards = json.loads(row["hazards"] or "[]")
        except json.JSONDecodeError:
            hazards = []
        analysis = {
            "status": row["victim_status"] or "unknown",
            "disasterType": row["disaster_type"] or "unknown",
            "confidence": (row["confidence"] or 0) / 100,
            "hazards": hazards if isinstance(hazards, list) else [],
        }
    try:
        location = json.loads(row["location"]) if row["location"] else None
    except json.JSONDecodeError:
        location = None
    return {
        "id": row["id"],
        "mediaType": row["media_type"],
        "mediaUrl": row["image_path"],
        "thumbnailUrl": row["thumbnail_path"],
        "source": row["source"],
        "caseId": row["case_id"],
        "location": location,
        "trapped": row["trapped"],
        "peopleAffected": row["people_affected"],
        "analysis": analysis,
        "receivedAt": row["timestamp"],
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
    global _last_stream_record

    now = datetime.now(timezone.utc)
    if is_stream_frame:
        if (
            _last_stream_record is not None
            and (now - _last_stream_record).total_seconds() < STREAM_EVIDENCE_INTERVAL_S
        ):
            return None
        _last_stream_record = now

    with get_connection() as connection:
        next_id = connection.execute(
            "SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) + 1 FROM evidence"
        ).fetchone()[0]
    evidence_id = f"ev-{next_id}"
    media_type = "video" if str(file_info.get("contentType", "")).startswith("video/") else "image"

    ext = _extension(
        file_info.get("filename"), file_info.get("contentType"),
        "mp4" if media_type == "video" else "jpg",
    )
    media_url = _save_file(file_content, f"{evidence_id}-{media_type}.{ext}")

    thumbnail_url = media_url 
    if media_type == "video" and frame_content:
        thumbnail_url = _save_file(frame_content, f"{evidence_id}-thumb.{frame_ext}")

    normalized_analysis = _normalize_analysis(analysis)
    with get_connection() as connection:
        connection.execute(
            """INSERT INTO evidence
            (id, case_id, image_path, disaster_type, victim_status, confidence, hazards, timestamp,
             media_type, thumbnail_path, source, location, trapped, people_affected)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (evidence_id, case_id, media_url,
             normalized_analysis.get("disasterType") if normalized_analysis else None,
             normalized_analysis.get("status") if normalized_analysis else None,
             round((normalized_analysis.get("confidence", 0) if normalized_analysis else 0) * 100),
             json.dumps(normalized_analysis.get("hazards", []) if normalized_analysis else []),
             now, media_type, thumbnail_url, "stream" if is_stream_frame else source,
             json.dumps(location) if location else None, trapped, people_affected),
        )

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
        "analysis": normalized_analysis,
        "receivedAt": now.isoformat(),
    }
    await sio.emit("evidence:new", record_dict)
    logger.info(
        "Evidence recorded: %s (%s, %s) analysis=%s",
        evidence_id, media_type, record_dict["source"],
        bool(record_dict["analysis"]),
    )
    return record_dict


def _delete_media_file(url: str | None) -> None:
    """Remove one persisted media file from disk; failures are logged, not raised."""
    if not url:
        return
    relative = url.lstrip("/")
    if relative.startswith("media/"):
        relative = relative[len("media/"):]
    path = os.path.join(MEDIA_ROOT, relative)
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as err:
        logger.warning("Could not delete evidence file %s: %s", path, err)


def delete_evidence(evidence_id: str) -> dict | None:
    """Remove one evidence record and its persisted media files."""
    record = get_evidence(evidence_id)
    if record is None:
        return None
    with get_connection() as connection:
        connection.execute("DELETE FROM evidence WHERE id = ?", (evidence_id,))
    _delete_media_file(record.get("mediaUrl"))
    _delete_media_file(record.get("thumbnailUrl"))
    logger.info("Evidence %s removed from store", evidence_id)
    return record


def list_evidence() -> list[dict]:
    """Return all evidence records, newest first."""
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM evidence ORDER BY timestamp DESC LIMIT ?", (MAX_EVIDENCE,)).fetchall()
    return [_row_to_record(row) for row in rows]


def get_evidence(evidence_id: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM evidence WHERE id = ?", (evidence_id,)).fetchone()
    return _row_to_record(row) if row else None


async def link_to_case(case_id: str, evidence_ids: list[str]) -> list[str]:
    """Attach evidence submitted before the SOS to its incident; returns linked ids."""
    with get_connection() as connection:
        placeholders = ",".join("?" for _ in evidence_ids)
        if not placeholders:
            return []
        rows = connection.execute(
            f"SELECT id FROM evidence WHERE id IN ({placeholders})", evidence_ids
        ).fetchall()
        linked = [row["id"] for row in rows]
        connection.executemany(
            "UPDATE evidence SET case_id = ? WHERE id = ?",
            [(case_id, evidence_id) for evidence_id in linked],
        )
    if linked:
        await sio.emit("evidence:updated", {"caseId": case_id, "evidenceIds": linked})
    return linked


async def unlink_from_case(case_id: str) -> list[str]:
    """Detach evidence from a deleted case so the gallery keeps no dangling ids."""
    with get_connection() as connection:
        rows = connection.execute("SELECT id FROM evidence WHERE case_id = ?", (case_id,)).fetchall()
        unlinked = [row["id"] for row in rows]
        connection.execute("UPDATE evidence SET case_id = NULL WHERE case_id = ?", (case_id,))
    if unlinked:
        await sio.emit("evidence:updated", {"caseId": None, "evidenceIds": unlinked})
    return unlinked


def aggregate() -> dict:
    """
    Compact stats over evidence submissions (per-submission view; triage_store
    holds the per-frame aggregation across every analyzed image).
    """
    records = list_evidence()
    disaster_types: dict[str, int] = {}
    victim_status: dict[str, int] = {}
    trapped_seen = 0
    for e in records:
        a = e.get("analysis")
        if a:
            disaster_types[a["disasterType"]] = disaster_types.get(a["disasterType"], 0) + 1
            victim_status[a["status"]] = victim_status.get(a["status"], 0) + 1
        if e.get("trapped") in ("yes", "partial"):
            trapped_seen += 1
    return {
        "total": len(records),
        "uploads": sum(1 for e in records if e["source"] == "upload"),
        "streamFrames": sum(1 for e in records if e["source"] == "stream"),
        "disasterTypes": disaster_types,
        "victimStatus": victim_status,
        "trappedSubmissions": trapped_seen,
        "latestReceivedAt": records[0]["receivedAt"] if records else None,
    }
