"""One-time (idempotent, thanks to IF NOT EXISTS) schema application. Run
manually: `python3 -m db.apply_schema`. Not part of any automated pipeline --
the schema doesn't change often enough to need migration tooling (see the
design spec's non-goals).
"""
from __future__ import annotations

import os
from pathlib import Path

import psycopg

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def apply_schema() -> None:
    database_url = os.environ["DATABASE_URL"]
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()


if __name__ == "__main__":
    apply_schema()
    print("schema applied")
