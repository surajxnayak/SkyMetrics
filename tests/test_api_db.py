import os

import pytest

from api.db import get_connection


def test_get_connection_raises_loudly_when_database_url_unset(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(KeyError):
        get_connection()


def test_get_connection_connects_to_the_real_database():
    # Uses the real DATABASE_URL from the environment -- this project's
    # established pattern (see index/backtest.py, api/auth.py) of verifying
    # against real state, not just mocks.
    if "DATABASE_URL" not in os.environ:
        pytest.skip("DATABASE_URL not set in this environment")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            assert cur.fetchone() == (1,)
    finally:
        conn.close()
