"""Small local SQLite persistence layer for incidents and evidence."""
import json
import sqlite3
from pathlib import Path
from typing import Any

DATABASE_PATH = Path(__file__).resolve().parents[1] / "muhafiz.db"


_SCHEMA = """
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT,
    coordinates TEXT,
    affected INTEGER NOT NULL DEFAULT 0,
    trapped TEXT NOT NULL DEFAULT 'no',
    damage TEXT NOT NULL DEFAULT 'minor',
    ai_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity_level TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    reported_by TEXT,
    is_guest_report INTEGER NOT NULL DEFAULT 0,
    evidence_ids TEXT
);
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    image_path TEXT NOT NULL,
    disaster_type TEXT,
    victim_status TEXT,
    confidence INTEGER NOT NULL DEFAULT 0,
    hazards TEXT,
    timestamp TIMESTAMP NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    thumbnail_path TEXT,
    source TEXT NOT NULL DEFAULT 'upload',
    location TEXT,
    trapped TEXT,
    people_affected INTEGER
);
"""

_SEED_INCIDENTS = [
    ("inc-1", "Forest Fire", "Margalla Hills, Islamabad", "33.7438, 73.0228", 1000, "yes", "severe", 78,),
    ("inc-2", "Flood", "Gulberg, Lahore", "31.5204, 74.3587", 900, "partial", "severe", 64),
    ("inc-3", "Earthquake", "Lake City, Lahore", "31.3667, 74.2500", 399, "no", "minor", 14),
    ("inc-4", "Sandstorm", "Coastal Highway, Karachi", "24.8607, 67.0011", 90, "no", "minor", 8),
]


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
        connection.executescript(_SCHEMA)
        if connection.execute("SELECT COUNT(*) FROM incidents").fetchone()[0] == 0:
            connection.executemany(
                """INSERT INTO incidents
                (id, title, location, coordinates, affected, trapped, damage, ai_score, created_at,
                 description, severity_level, status, reported_by, is_guest_report, evidence_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), '', ?, 'open', 'Seed data', 0, '[]')""",
                [(*incident, "critical" if incident[7] >= 75 else "high" if incident[7] >= 50 else "medium") for incident in _SEED_INCIDENTS],
            )


def json_text(value: Any) -> str:
    return json.dumps(value if value is not None else {})


init_database()
