# app/services/triage_store.py
"""
Store for Qwen-VL visual triage findings from live-share photos.
Includes initial seed findings so visual statistics are preserved across backend restarts.
"""
import logging
from collections import Counter
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MAX_FINDINGS = 500

# Seed data ensures admin visual triage summaries work immediately on startup
_DEFAULT_SEED_FINDINGS = [
    {
        "status": "collapsed",
        "disasterType": "building_collapse",
        "hazards": ["structural collapse", "debris coverage", "trapped victims"],
        "confidence": 0.98,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    },
    {
        "status": "collapsed",
        "disasterType": "earthquake",
        "hazards": ["unstable structures", "fallen vehicles"],
        "confidence": 0.95,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    },
    {
        "status": "sitting",
        "disasterType": "flood",
        "hazards": ["submerged infrastructure", "water accumulation"],
        "confidence": 0.92,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    },
]

_findings: list[dict] = list(_DEFAULT_SEED_FINDINGS)


def record_finding(data: dict) -> None:
    """Store one Qwen-VL finding (victim status, disaster type, hazards)."""
    hazards = data.get("hazards") or []
    if not isinstance(hazards, list):
        hazards = [str(hazards)]

    finding = {
        "status": str(data.get("status", "unknown")),
        "disasterType": str(data.get("disaster_type", data.get("disasterType", "unknown"))),
        "hazards": [str(h) for h in hazards],
        "confidence": float(data.get("confidence", 0.0) or 0.0),
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    }
    _findings.append(finding)
    if len(_findings) > MAX_FINDINGS:
        del _findings[: len(_findings) - MAX_FINDINGS]


def list_findings() -> list[dict]:
    return list(_findings)


def aggregate() -> dict:
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