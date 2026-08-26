"""Postgres connection helper. DATABASE_URL has no default and is read
fresh on every call -- same fail-loud, no-hidden-fallback convention as
api/auth.py's SKYMETRICS_API_KEYS.
"""
from __future__ import annotations

import os

import psycopg


def get_connection() -> psycopg.Connection:
    database_url = os.environ["DATABASE_URL"]
    return psycopg.connect(database_url)


def get_db_connection():
    """FastAPI dependency: yields a connection, closes it after the request."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
