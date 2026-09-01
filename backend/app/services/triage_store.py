# app/services/triage_store.py
"""
In-memory store for Qwen-VL visual triage findings from live-share photos.

Every time a victim-submitted frame is analyzed (livestream WebSocket or the
monitor frame endpoint), the finding is recorded here so the Admin AI
Assistant can aggregate what the field is seeing across all submissions.
Replace with a real DB for production.
"""
import logging
from collections import Counter
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Keep only the most recent findings — this is an operations window, not an archive.
MAX_FINDINGS = 500

_findings: list[dict] = []


def record_finding(data: dict) -> None:
    """
    Store one Qwen-VL finding (victim status, disaster type, hazards).
    Malformed fields fall back to "unknown" so aggregation never breaks.
    """
    hazards = data.get("hazards") or []
    if not isinstance(hazards, list):
        hazards = [str(hazards)]

    finding = {
        "status": str(data.get("status", "unknown")),
        "disasterType": str(data.get("disaster_type", "unknown")),
        "hazards": [str(h) for h in hazards],
        "confidence": float(data.get("confidence", 0.0) or 0.0),
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    }
    _findings.append(finding)
    if len(_findings) > MAX_FINDINGS:
        del _findings[: len(_findings) - MAX_FINDINGS]


def list_findings() -> list[dict]:
    """Return all stored findings, oldest first."""
    return list(_findings)


def aggregate() -> dict:
    """
    Aggregate stored findings into the visual triage section of the Admin AI
    Assistant's operations snapshot: disaster-type frequencies, victim status
    counts, and the most common hazards.
    """
    disaster_types = Counter(f["disasterType"] for f in _findings)
    statuses = Counter(f["status"] for f in _findings)
    hazard_counts = Counter(h for f in _findings for h in f["hazards"])

    return {
        "totalFrames": len(_findings),
        "disasterTypes": dict(disaster_types),
        "victimStatus": dict(statuses),
        "topHazards": [
            {"hazard": hazard, "count": count}
            for hazard, count in hazard_counts.most_common(5)
        ],
        "latestAnalyzedAt": _findings[-1]["analyzedAt"] if _findings else None,
    }
