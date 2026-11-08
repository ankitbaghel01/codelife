"""SQLite storage (stdlib only). Tables are created on startup."""

import os
import sqlite3
from pathlib import Path

PATH = Path(
    os.environ.get(
        "CODELIFE_DB", Path(__file__).resolve().parent / "data" / "codelife.db"
    )
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL, company_id TEXT NOT NULL, role_id TEXT NOT NULL,
  profile TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
  evaluation TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (  -- one row per question; holds the answer and its score
  interview_id TEXT NOT NULL, idx INTEGER NOT NULL, round_idx INTEGER NOT NULL, kind TEXT NOT NULL,
  mandatory INTEGER NOT NULL, topic TEXT, ref TEXT, prompt TEXT, answer TEXT, score REAL, feedback TEXT,
  answered_at TEXT, PRIMARY KEY (interview_id, idx)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, interview_id TEXT NOT NULL, seq INTEGER NOT NULL, speaker TEXT NOT NULL,
  text TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, interview_id TEXT NOT NULL, question_idx INTEGER NOT NULL, problem_id TEXT NOT NULL,
  mode TEXT NOT NULL, language TEXT NOT NULL, code TEXT NOT NULL, result TEXT NOT NULL,
  passed INTEGER NOT NULL, total INTEGER NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_by_interview ON messages (interview_id, seq);
CREATE INDEX IF NOT EXISTS submissions_by_question ON submissions (interview_id, question_idx, mode);
"""


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(PATH, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init() -> None:
    PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.executescript(SCHEMA)
