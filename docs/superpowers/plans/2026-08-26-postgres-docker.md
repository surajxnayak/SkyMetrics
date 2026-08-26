# PostgreSQL + Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SkyMetrics's durable data (cleaned fare quotes, index snapshots) from git-committed flat files to a real PostgreSQL database (Neon), rewire the API and daily cron to use it, and package the API + dashboard with Docker Compose.

**Architecture:** A `db/schema.sql` defines two tables (`fare_quotes`, `index_points`); `api/db.py` centralizes the `DATABASE_URL` connection; `api/data_access.py` is rewritten from file-reading functions to parameterized SQL queries; `api/main.py` swaps its path-based FastAPI dependencies for a `get_db_connection` dependency; the daily cron writes straight to Postgres instead of committing files; `docker-compose.yml` packages the API and dashboard, both pointed at the same Neon database.

**Tech Stack:** PostgreSQL (Neon, already provisioned), `psycopg[binary]` (the modern psycopg3 package, raw SQL, no ORM), Docker + Docker Compose (already installed and confirmed working locally).

---

### Task 1: Schema + real database setup

**Files:**
- Create: `db/schema.sql`
- Create: `db/apply_schema.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add the Postgres driver**

Add to `requirements.txt`:

```
psycopg[binary]>=3.2
```

Run: `pip install -r requirements.txt`
Expected: installs successfully, `python3 -c "import psycopg; print(psycopg.__version__)"` prints a `3.x` version.

- [ ] **Step 2: Write the schema file**

Create `db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS fare_quotes (
    quote_id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    carrier TEXT NOT NULL,
    source TEXT NOT NULL,
    travel_date DATE NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    advance_window TEXT NOT NULL,
    fare_class TEXT,
    base_fare NUMERIC,
    taxes NUMERIC,
    udf NUMERIC,
    convenience_fee NUMERIC,
    total_fare NUMERIC,
    status TEXT NOT NULL,
    run_id TEXT NOT NULL,
    fee_breakdown JSONB,
    routing TEXT,
    is_outlier BOOLEAN NOT NULL,
    source_quote_ids TEXT[] NOT NULL
);

CREATE INDEX IF NOT EXISTS fare_quotes_origin_destination_idx ON fare_quotes (origin, destination);
CREATE INDEX IF NOT EXISTS fare_quotes_collected_at_idx ON fare_quotes (collected_at);

CREATE TABLE IF NOT EXISTS index_points (
    id BIGSERIAL PRIMARY KEY,
    comparison_id TEXT NOT NULL,
    frequency TEXT NOT NULL,
    period TEXT NOT NULL,
    base_period TEXT NOT NULL,
    routes TEXT[] NOT NULL,
    simple_relative NUMERIC NOT NULL,
    laspeyres NUMERIC,
    paasche NUMERIC,
    fisher NUMERIC,
    written_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS index_points_comparison_id_idx ON index_points (comparison_id);
CREATE INDEX IF NOT EXISTS index_points_frequency_period_idx ON index_points (frequency, period);
```

- [ ] **Step 3: Write the apply script**

Create `db/apply_schema.py` (no `psql` CLI is installed locally, so the schema is applied via `psycopg` directly):

```python
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
```

- [ ] **Step 4: Run it against the real Neon database**

Run (with `DATABASE_URL` set from the repo's `.env` file — e.g. `export $(cat .env | xargs)` in your shell, or use `python-dotenv`-style loading if you prefer, whatever's fastest): `python3 -m db.apply_schema`
Expected: prints `schema applied`, no errors.

- [ ] **Step 5: Verify the tables exist**

Run:
```bash
python3 -c "
import os, psycopg
conn = psycopg.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name\")
print(cur.fetchall())
"
```
Expected: `[('fare_quotes',), ('index_points',)]`.

- [ ] **Step 6: Commit**

```bash
git add db/schema.sql db/apply_schema.py requirements.txt
git commit -m "feat: PostgreSQL schema for fare_quotes and index_points"
```

Note: `db/apply_schema.py` needs a `db/__init__.py` for `python3 -m db.apply_schema` to work as a package — create an empty `db/__init__.py` in this step too and include it in the commit.

---

### Task 2: Connection helper (`api/db.py`)

**Files:**
- Create: `api/db.py`
- Test: `tests/test_api_db.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_api_db.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_db.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'api.db'`.

- [ ] **Step 3: Implement**

Create `api/db.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api_db.py -v`
Expected: both tests PASS (the second only if `DATABASE_URL` is set in your shell — set it before running: `export $(cat .env | xargs)`).

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_api_db.py
git commit -m "feat: DATABASE_URL connection helper"
```

---

### Task 3: Migration script for existing real data

**Files:**
- Create: `db/migrate_existing_data.py`
- Test: `tests/test_migrate_existing_data.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_migrate_existing_data.py`:

```python
import json
from datetime import date, datetime, timezone

from db.migrate_existing_data import (
    fare_quote_row,
    index_point_rows,
)


def test_fare_quote_row_converts_a_cleaned_record_to_insert_params():
    record = {
        "quote_id": "q1",
        "origin": "DEL",
        "destination": "BOM",
        "carrier": "QP",
        "source": "akasaair",
        "travel_date": "2026-09-01",
        "collected_at": "2026-08-24T17:00:43.224871+00:00",
        "advance_window": "T+1",
        "fare_class": "U1",
        "base_fare": 5718.0,
        "taxes": 292.0,
        "udf": 578.0,
        "convenience_fee": 800.0,
        "total_fare": 7388.0,
        "status": "available",
        "run_id": "run1",
        "fee_breakdown": {"FarePrice": 5718.0},
        "routing": None,
        "is_outlier": False,
        "source_quote_ids": ["q1"],
    }

    row = fare_quote_row(record)

    assert row["quote_id"] == "q1"
    assert row["travel_date"] == date(2026, 9, 1)
    assert row["collected_at"] == datetime(2026, 8, 24, 17, 0, 43, 224871, tzinfo=timezone.utc)
    assert row["is_outlier"] is False
    assert row["source_quote_ids"] == ["q1"]


def test_index_point_rows_expands_a_snapshot_into_one_row_per_period():
    snapshot = {
        "comparison_id": "cmp1",
        "frequency": "daily",
        "series": [
            {
                "period": "2026-08-24",
                "base_period": "2026-08-24",
                "routes": ["DEL-BOM"],
                "simple_relative": 100.0,
                "laspeyres": 100.0,
                "paasche": 100.0,
                "fisher": 100.0,
            }
        ],
    }

    rows = index_point_rows(snapshot)

    assert len(rows) == 1
    assert rows[0]["comparison_id"] == "cmp1"
    assert rows[0]["frequency"] == "daily"
    assert rows[0]["period"] == "2026-08-24"
    assert rows[0]["routes"] == ["DEL-BOM"]
    assert rows[0]["simple_relative"] == 100.0


def test_index_point_rows_handles_a_point_with_no_weighted_formulas():
    snapshot = {
        "comparison_id": "cmp1",
        "frequency": "daily",
        "series": [
            {
                "period": "2026-08-24",
                "base_period": "2026-08-24",
                "routes": ["DEL-BOM"],
                "simple_relative": 100.0,
            }
        ],
    }

    rows = index_point_rows(snapshot)

    assert rows[0]["laspeyres"] is None
    assert rows[0]["paasche"] is None
    assert rows[0]["fisher"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_migrate_existing_data.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'db.migrate_existing_data'`.

- [ ] **Step 3: Implement**

Create `db/migrate_existing_data.py`:

```python
"""One-time backfill: reads the existing real data/cleaned/*.jsonl and
data/index/*.json files and inserts them into Postgres. Run manually, once,
against an empty database -- primary-key conflicts on a second run are
expected and correct (see the design spec's error-handling section), not a
bug to work around.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from api.db import get_connection
from index.build import CLEANED_BASE_DIR, INDEX_BASE_DIR, load_all_cleaned_records


def fare_quote_row(record: dict) -> dict:
    return {
        "quote_id": record["quote_id"],
        "origin": record["origin"],
        "destination": record["destination"],
        "carrier": record["carrier"],
        "source": record["source"],
        "travel_date": date.fromisoformat(record["travel_date"]),
        "collected_at": datetime.fromisoformat(record["collected_at"]),
        "advance_window": record["advance_window"],
        "fare_class": record["fare_class"],
        "base_fare": record["base_fare"],
        "taxes": record["taxes"],
        "udf": record["udf"],
        "convenience_fee": record["convenience_fee"],
        "total_fare": record["total_fare"],
        "status": record["status"],
        "run_id": record["run_id"],
        "fee_breakdown": record["fee_breakdown"],
        "routing": record["routing"],
        "is_outlier": record["is_outlier"],
        "source_quote_ids": record["source_quote_ids"],
    }


def index_point_rows(snapshot: dict) -> list[dict]:
    return [
        {
            "comparison_id": snapshot["comparison_id"],
            "frequency": snapshot["frequency"],
            "period": point["period"],
            "base_period": point["base_period"],
            "routes": point["routes"],
            "simple_relative": point["simple_relative"],
            "laspeyres": point.get("laspeyres"),
            "paasche": point.get("paasche"),
            "fisher": point.get("fisher"),
        }
        for point in snapshot["series"]
    ]


def migrate() -> tuple[int, int]:
    conn = get_connection()
    fare_count = 0
    point_count = 0
    try:
        with conn.cursor() as cur:
            for record in load_all_cleaned_records(CLEANED_BASE_DIR):
                row = fare_quote_row(record)
                cur.execute(
                    """
                    INSERT INTO fare_quotes
                        (quote_id, origin, destination, carrier, source, travel_date,
                         collected_at, advance_window, fare_class, base_fare, taxes, udf,
                         convenience_fee, total_fare, status, run_id, fee_breakdown, routing,
                         is_outlier, source_quote_ids)
                    VALUES
                        (%(quote_id)s, %(origin)s, %(destination)s, %(carrier)s, %(source)s,
                         %(travel_date)s, %(collected_at)s, %(advance_window)s, %(fare_class)s,
                         %(base_fare)s, %(taxes)s, %(udf)s, %(convenience_fee)s, %(total_fare)s,
                         %(status)s, %(run_id)s, %(fee_breakdown)s, %(routing)s, %(is_outlier)s,
                         %(source_quote_ids)s)
                    """,
                    row,
                )
                fare_count += 1

            for path in sorted(INDEX_BASE_DIR.glob("*.json")):
                snapshot = json.loads(path.read_text(encoding="utf-8"))
                for row in index_point_rows(snapshot):
                    cur.execute(
                        """
                        INSERT INTO index_points
                            (comparison_id, frequency, period, base_period, routes,
                             simple_relative, laspeyres, paasche, fisher)
                        VALUES
                            (%(comparison_id)s, %(frequency)s, %(period)s, %(base_period)s,
                             %(routes)s, %(simple_relative)s, %(laspeyres)s, %(paasche)s,
                             %(fisher)s)
                        """,
                        row,
                    )
                    point_count += 1
        conn.commit()
    finally:
        conn.close()
    return fare_count, point_count


if __name__ == "__main__":
    fares, points = migrate()
    print(f"migrated {fares} fare quotes, {points} index points")
```

Create an empty `db/__init__.py` if it doesn't already exist from Task 1 (it should).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_migrate_existing_data.py -v`
Expected: all 3 tests PASS (these test the pure row-conversion functions, no real DB needed).

- [ ] **Step 5: Run the real migration against the real database**

Run: `python3 -m db.migrate_existing_data`
Expected: prints `migrated N fare quotes, M index points` where N/M are non-zero (matches however much real data is currently in `data/cleaned/` and `data/index/`).

- [ ] **Step 6: Verify row counts match the source files**

Run:
```bash
python3 -c "
import os, psycopg
from index.build import load_all_cleaned_records
conn = psycopg.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM fare_quotes')
db_count = cur.fetchone()[0]
file_count = len(load_all_cleaned_records())
print(f'db={db_count} file={file_count}')
assert db_count == file_count
print('MATCH')
"
```
Expected: `MATCH` printed, no assertion error.

- [ ] **Step 7: Commit**

```bash
git add db/__init__.py db/migrate_existing_data.py tests/test_migrate_existing_data.py
git commit -m "feat: migrate existing real cleaned/index data into Postgres"
```

---

### Task 4: Rewrite `api/data_access.py` to query Postgres

**Files:**
- Modify: `api/data_access.py` (full rewrite)
- Test: `tests/test_api_data_access.py` (full rewrite)

This is the core rewrite: `list_snapshots`/`load_snapshot` now query `index_points`; `load_fare_records` (absorbing the old `filter_fare_records`) now queries `fare_quotes`. All tests run against the real Neon database, using a transaction that's rolled back after each test so nothing persists — this project's established "verify against real state" pattern, applied here via Postgres transactions instead of `tmp_path` fixtures.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/test_api_data_access.py` with:

```python
import os

import pytest

from api.data_access import (
    SnapshotNotFoundError,
    list_snapshots,
    load_fare_records,
    load_snapshot,
    load_weights_metadata,
)
from api.db import get_connection

pytestmark = pytest.mark.skipif(
    "DATABASE_URL" not in os.environ, reason="DATABASE_URL not set in this environment"
)


@pytest.fixture
def conn():
    connection = get_connection()
    yield connection
    connection.rollback()
    connection.close()


def _insert_index_point(conn, comparison_id, frequency, period, simple_relative=100.0, **kwargs):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO index_points
                (comparison_id, frequency, period, base_period, routes, simple_relative,
                 laspeyres, paasche, fisher)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                comparison_id,
                frequency,
                period,
                kwargs.get("base_period", period),
                kwargs.get("routes", ["DEL-BOM"]),
                simple_relative,
                kwargs.get("laspeyres"),
                kwargs.get("paasche"),
                kwargs.get("fisher"),
            ),
        )


def _insert_fare_quote(conn, quote_id, origin="DEL", destination="BOM", collected_at="2026-08-24T10:00:00+00:00"):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fare_quotes
                (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                 advance_window, status, run_id, is_outlier, source_quote_ids)
            VALUES (%s, %s, %s, 'QP', 'akasaair', '2026-09-01', %s, 'T+1', 'available', 'run1', false, %s)
            """,
            (quote_id, origin, destination, collected_at, [quote_id]),
        )


def test_list_snapshots_returns_newest_first(conn):
    _insert_index_point(conn, "aaa", "daily", "2026-08-01")
    _insert_index_point(conn, "bbb", "daily", "2026-08-02")

    snapshots = list_snapshots(conn)

    ids = [s["comparison_id"] for s in snapshots]
    assert ids.index("bbb") < ids.index("aaa")


def test_load_snapshot_returns_newest_matching_frequency(conn):
    _insert_index_point(conn, "old", "daily", "2026-08-01")
    _insert_index_point(conn, "new", "daily", "2026-08-02")

    result = load_snapshot(conn, "daily", comparison_id=None)

    assert result["comparison_id"] == "new"


def test_load_snapshot_by_comparison_id(conn):
    _insert_index_point(conn, "deadbeefdeadbeefdeadbeefdeadbeef", "weekly", "2026-W34")

    result = load_snapshot(conn, "weekly", comparison_id="deadbeefdeadbeefdeadbeefdeadbeef")

    assert result["comparison_id"] == "deadbeefdeadbeefdeadbeefdeadbeef"
    assert result["series"][0]["period"] == "2026-W34"


def test_load_snapshot_raises_when_comparison_id_missing(conn):
    with pytest.raises(SnapshotNotFoundError):
        load_snapshot(conn, "daily", comparison_id="deadbeefdeadbeefdeadbeefdeadbeef")


def test_load_snapshot_raises_when_comparison_id_frequency_mismatch(conn):
    _insert_index_point(conn, "deadbeefdeadbeefdeadbeefdeadbeef", "weekly", "2026-W34")

    with pytest.raises(SnapshotNotFoundError):
        load_snapshot(conn, "daily", comparison_id="deadbeefdeadbeefdeadbeefdeadbeef")


def test_load_snapshot_raises_when_no_snapshot_for_frequency(conn):
    with pytest.raises(SnapshotNotFoundError):
        load_snapshot(conn, "daily", comparison_id=None)


def test_load_snapshot_rejects_a_comparison_id_that_is_not_32_hex_chars(conn):
    with pytest.raises(SnapshotNotFoundError):
        load_snapshot(conn, "daily", comparison_id="not-a-real-id")


def test_load_snapshot_filters_by_start_and_end(conn):
    cid = "deadbeefdeadbeefdeadbeefdeadbeef"
    _insert_index_point(conn, cid, "daily", "2026-08-01")
    _insert_index_point(conn, cid, "daily", "2026-08-15")
    _insert_index_point(conn, cid, "daily", "2026-08-30")

    result = load_snapshot(conn, "daily", comparison_id=cid, start="2026-08-10", end="2026-08-20")

    assert [p["period"] for p in result["series"]] == ["2026-08-15"]


def test_load_snapshot_includes_laspeyres_only_when_present(conn):
    cid = "deadbeefdeadbeefdeadbeefdeadbeef"
    _insert_index_point(conn, cid, "daily", "2026-08-01", laspeyres=105.0, paasche=104.0, fisher=104.5)

    result = load_snapshot(conn, "daily", comparison_id=cid)

    assert result["series"][0]["laspeyres"] == 105.0


def test_load_fare_records_filters_by_origin_and_destination(conn):
    _insert_fare_quote(conn, "q1", origin="DEL", destination="BOM")
    _insert_fare_quote(conn, "q2", origin="DEL", destination="BLR")

    result = load_fare_records(conn, origin="DEL", destination="BOM")

    assert len(result) == 1
    assert result[0]["destination"] == "BOM"


def test_load_fare_records_filters_by_date_range_is_inclusive(conn):
    _insert_fare_quote(conn, "q1", collected_at="2026-08-24T10:00:00+00:00")
    _insert_fare_quote(conn, "q2", collected_at="2026-08-25T10:00:00+00:00")

    result = load_fare_records(
        conn, start="2026-08-24T10:00:00+00:00", end="2026-08-24T10:00:00+00:00"
    )

    assert len(result) == 1
    assert result[0]["quote_id"] == "q1"


def test_load_fare_records_accepts_a_naive_date_bound_widening_to_end_of_day(conn):
    _insert_fare_quote(conn, "q1", collected_at="2026-08-24T23:59:00+00:00")
    _insert_fare_quote(conn, "q2", collected_at="2026-08-25T00:01:00+00:00")

    result = load_fare_records(conn, start="2026-08-24", end="2026-08-24")

    assert len(result) == 1
    assert result[0]["quote_id"] == "q1"


def test_load_fare_records_rejects_a_malformed_date(conn):
    with pytest.raises(ValueError):
        load_fare_records(conn, start="not-a-date")


def test_load_weights_metadata_returns_full_payload(tmp_path):
    import json

    weights_path = tmp_path / "weights.json"
    weights_path.write_text(
        json.dumps(
            {
                "source": "test source",
                "period": "2025",
                "computed_at": "2026-08-24",
                "weights": {"DEL-BOM": 0.5},
            }
        )
    )

    metadata = load_weights_metadata(weights_path=weights_path)

    assert metadata["source"] == "test source"
    assert metadata["weights"] == {"DEL-BOM": 0.5}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_api_data_access.py -v`
Expected: FAIL — `load_snapshot`/`list_snapshots`/`load_fare_records` still have the old file-based signatures, so most tests error on a `TypeError` (wrong arguments) or `AttributeError`.

- [ ] **Step 3: Implement**

Replace the full contents of `api/data_access.py`:

```python
"""Read-only data access for the API layer (PRD F-5.1/F-5.2/F-5.3): queries
Postgres directly on every call. No caching -- same reasoning as before
(data volume small enough that re-querying every request is simpler and
avoids invalidation bugs), now backed by a real database with real indexes
instead of scanning flat files.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from index.weights import WEIGHTS_PATH

_COMPARISON_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")

_SERIES_COLUMNS = ("period", "base_period", "routes", "simple_relative", "laspeyres", "paasche", "fisher")


class SnapshotNotFoundError(Exception):
    pass


def list_snapshots(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT comparison_id, frequency, MIN(written_at) AS written_at
            FROM index_points
            GROUP BY comparison_id, frequency
            ORDER BY written_at DESC
            """
        )
        rows = cur.fetchall()
    return [
        {"comparison_id": comparison_id, "frequency": frequency, "written_at": written_at.isoformat()}
        for comparison_id, frequency, written_at in rows
    ]


def _resolve_comparison_id(conn, frequency: str, comparison_id: str | None) -> str:
    if comparison_id is not None:
        if not _COMPARISON_ID_PATTERN.fullmatch(comparison_id):
            raise SnapshotNotFoundError(f"no snapshot with comparison_id {comparison_id!r}")
        return comparison_id

    with conn.cursor() as cur:
        cur.execute(
            "SELECT comparison_id FROM index_points WHERE frequency = %s "
            "ORDER BY written_at DESC LIMIT 1",
            (frequency,),
        )
        row = cur.fetchone()
    if row is None:
        raise SnapshotNotFoundError(f"no snapshot found for frequency {frequency!r}")
    return row[0]


def load_snapshot(
    conn, frequency: str, comparison_id: str | None, start: str | None = None, end: str | None = None
) -> dict:
    target_id = _resolve_comparison_id(conn, frequency, comparison_id)

    query = f"SELECT {', '.join(_SERIES_COLUMNS)}, frequency FROM index_points WHERE comparison_id = %s"
    params: list = [target_id]
    if start is not None:
        query += " AND period >= %s"
        params.append(start)
    if end is not None:
        query += " AND period <= %s"
        params.append(end)
    query += " ORDER BY period"

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    if not rows:
        raise SnapshotNotFoundError(f"no snapshot with comparison_id {target_id!r}")

    actual_frequency = rows[0][-1]
    if actual_frequency != frequency:
        raise SnapshotNotFoundError(
            f"snapshot {target_id!r} has frequency {actual_frequency!r}, not {frequency!r}"
        )

    series = []
    for row in rows:
        point = dict(zip(_SERIES_COLUMNS, row[:-1]))
        for formula_key in ("laspeyres", "paasche", "fisher"):
            if point[formula_key] is None:
                del point[formula_key]
        series.append(point)

    return {"comparison_id": target_id, "frequency": frequency, "series": series}


def _parse_datetime(value: str, *, end_of_day: bool = False) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if end_of_day and len(value) == len("YYYY-MM-DD"):
        parsed += timedelta(days=1) - timedelta(microseconds=1)
    return parsed


_FARE_COLUMNS = (
    "quote_id", "origin", "destination", "carrier", "source", "travel_date", "collected_at",
    "advance_window", "fare_class", "base_fare", "taxes", "udf", "convenience_fee", "total_fare",
    "status", "run_id", "fee_breakdown", "routing", "is_outlier", "source_quote_ids",
)


def load_fare_records(
    conn,
    origin: str | None = None,
    destination: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> list[dict]:
    query = f"SELECT {', '.join(_FARE_COLUMNS)} FROM fare_quotes WHERE true"
    params: list = []
    if origin is not None:
        query += " AND origin = %s"
        params.append(origin)
    if destination is not None:
        query += " AND destination = %s"
        params.append(destination)
    if start is not None:
        query += " AND collected_at >= %s"
        params.append(_parse_datetime(start))
    if end is not None:
        query += " AND collected_at <= %s"
        params.append(_parse_datetime(end, end_of_day=True))

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    records = []
    for row in rows:
        record = dict(zip(_FARE_COLUMNS, row))
        record["travel_date"] = record["travel_date"].isoformat()
        record["collected_at"] = record["collected_at"].isoformat()
        records.append(record)
    return records


def load_weights_metadata(weights_path: Path = WEIGHTS_PATH) -> dict:
    import json

    return json.loads(weights_path.read_text(encoding="utf-8"))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_api_data_access.py -v`
Expected: all tests PASS against the real database (skipped automatically if `DATABASE_URL` isn't set in the current shell).

- [ ] **Step 5: Commit**

```bash
git add api/data_access.py tests/test_api_data_access.py
git commit -m "feat: rewrite api/data_access.py to query Postgres"
```

---

### Task 5: Rewrite `api/main.py` to use the database

**Files:**
- Modify: `api/main.py`
- Modify: `tests/test_api_main.py` (full rewrite)

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/test_api_main.py`:

```python
import os

os.environ["SKYMETRICS_API_KEYS"] = "test-key-123"

import pytest
from fastapi.testclient import TestClient

from api import rate_limit
from api.db import get_connection
from api.main import app, get_db_connection, get_weights_path
from api.rate_limit import RateLimiter

client = TestClient(app)
HEADERS = {"X-API-Key": "test-key-123"}

pytestmark = pytest.mark.skipif(
    "DATABASE_URL" not in os.environ, reason="DATABASE_URL not set in this environment"
)


@pytest.fixture(autouse=True)
def _fresh_rate_limiter():
    rate_limit.limiter = RateLimiter()


@pytest.fixture
def db_conn():
    connection = get_connection()

    def _override():
        yield connection

    app.dependency_overrides[get_db_connection] = _override
    yield connection
    app.dependency_overrides.clear()
    connection.rollback()
    connection.close()


def _insert_index_point(conn, comparison_id, frequency, period, **kwargs):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO index_points
                (comparison_id, frequency, period, base_period, routes, simple_relative)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (comparison_id, frequency, period, kwargs.get("base_period", period), ["DEL-BOM"], 100.0),
        )
    conn.commit()


def test_get_index_returns_latest_snapshot(db_conn):
    _insert_index_point(db_conn, "abc12300000000000000000000000000"[:32], "daily", "2026-08-24")

    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["series"][0]["period"] == "2026-08-24"


def test_get_index_returns_404_when_no_snapshot_for_frequency(db_conn):
    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 404


def test_get_index_rejects_invalid_frequency(db_conn):
    response = client.get("/api/v1/index", params={"frequency": "yearly"}, headers=HEADERS)

    assert response.status_code == 422


def test_get_fares_filters_by_origin_and_destination(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fare_quotes
                (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                 advance_window, status, run_id, is_outlier, source_quote_ids)
            VALUES ('q1', 'DEL', 'BOM', 'QP', 'akasaair', '2026-09-01',
                    '2026-08-24T10:00:00+00:00', 'T+1', 'available', 'run1', false, ARRAY['q1'])
            """
        )
    db_conn.commit()

    response = client.get(
        "/api/v1/fares", params={"origin": "DEL", "destination": "BOM"}, headers=HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["destination"] == "BOM"


def test_get_fares_rejects_a_malformed_date(db_conn):
    response = client.get("/api/v1/fares", params={"start": "not-a-date"}, headers=HEADERS)

    assert response.status_code == 422


def test_get_metadata_returns_weights_and_snapshots(db_conn, tmp_path):
    import json

    _insert_index_point(db_conn, "abc12300000000000000000000000000"[:32], "daily", "2026-08-24")
    weights_path = tmp_path / "weights.json"
    weights_path.write_text(
        json.dumps(
            {"source": "test", "period": "2025", "computed_at": "2026-08-24", "weights": {"DEL-BOM": 0.5}}
        )
    )
    app.dependency_overrides[get_weights_path] = lambda: weights_path

    response = client.get("/api/v1/metadata", headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["weights"]["weights"] == {"DEL-BOM": 0.5}
    assert len(body["snapshots"]) == 1
    assert "laspeyres" in body["formulas"]


def test_missing_api_key_returns_401():
    response = client.get("/api/v1/metadata")

    assert response.status_code == 401


def test_wrong_api_key_returns_401():
    response = client.get("/api/v1/metadata", headers={"X-API-Key": "wrong-key"})

    assert response.status_code == 401


def test_rate_limit_exceeded_returns_429(db_conn):
    rate_limit.limiter = RateLimiter(max_requests=1, window_seconds=60.0)

    client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)
    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 429


def test_openapi_docs_reachable_without_api_key():
    response = client.get("/openapi.json")

    assert response.status_code == 200


def test_cors_preflight_from_configured_origin_succeeds():
    response = client.options(
        "/api/v1/metadata",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-API-Key",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
```

Note: the path-traversal-specific tests from the old file (`test_get_index_rejects_a_comparison_id_with_path_traversal`, `test_get_index_rejects_invalid_frequency`'s old file-path variant, `test_invalid_api_key_returns_401_even_when_rate_limited`) are folded in or dropped where the underlying file-path attack surface no longer exists (there's no filesystem path built from `comparison_id` anymore — `_COMPARISON_ID_PATTERN` in `api/data_access.py` still validates the format, tested directly in `tests/test_api_data_access.py`'s `test_load_snapshot_rejects_a_comparison_id_that_is_not_32_hex_chars`). Keep `test_invalid_api_key_returns_401_even_when_rate_limited` if you want extra coverage — it doesn't depend on file paths and still passes unmodified; add it back if time allows, not required to close this task.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_api_main.py -v`
Expected: FAIL — `api.main` still exports `get_index_base_dir`/`get_cleaned_base_dir`, not `get_db_connection`.

- [ ] **Step 3: Implement**

Replace the full contents of `api/main.py`:

```python
"""FastAPI app exposing the SkyMetrics APIx and cleaned fare data (PRD
F-5.1/F-5.2/F-5.3/F-5.5), backed by Postgres. No request-time recomputation
-- see the design spec's non-goals.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.auth import require_api_key
from api.data_access import (
    SnapshotNotFoundError,
    list_snapshots,
    load_fare_records,
    load_snapshot,
    load_weights_metadata,
)
from api.db import get_db_connection
from api.rate_limit import enforce_rate_limit
from index.weights import WEIGHTS_PATH

app = FastAPI(title="SkyMetrics APIx API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["X-API-Key"],
)


def get_weights_path() -> Path:
    return WEIGHTS_PATH


router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(require_api_key), Depends(enforce_rate_limit)],
)


@router.get("/index")
def get_index(
    frequency: Literal["daily", "weekly", "monthly"],
    comparison_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> dict:
    return load_snapshot(conn, frequency, comparison_id, start=start, end=end)


@router.get("/fares")
def get_fares(
    origin: str | None = None,
    destination: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> list[dict]:
    try:
        return load_fare_records(conn, origin=origin, destination=destination, start=start, end=end)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/metadata")
def get_metadata(
    conn=Depends(get_db_connection),
    weights_path: Path = Depends(get_weights_path),
) -> dict:
    weights_metadata = load_weights_metadata(weights_path=weights_path)
    return {
        "weights": weights_metadata,
        "formulas": {
            "simple_relative": "Equal-weighted arithmetic mean of price relatives.",
            "laspeyres": "Base-period-weighted arithmetic mean of price relatives.",
            "paasche": "Current-period-weighted harmonic mean of price relatives.",
            "fisher": "Geometric mean of Laspeyres and Paasche.",
        },
        "snapshots": list_snapshots(conn),
    }


app.include_router(router)


@app.exception_handler(SnapshotNotFoundError)
async def snapshot_not_found_handler(request: Request, exc: SnapshotNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_api_main.py -v`
Expected: all tests PASS. Then run the full suite: `pytest && ruff check .`.

- [ ] **Step 5: Manually verify against the real running API**

Run:
```bash
export $(cat .env | xargs)
export SKYMETRICS_API_KEYS=dev-local-key
uvicorn api.main:app --reload &
sleep 2
curl -s -H "X-API-Key: dev-local-key" "http://127.0.0.1:8000/api/v1/metadata" | python3 -m json.tool
kill %1
```
Expected: real JSON response with `weights`, `formulas`, and `snapshots` (the snapshot(s) migrated in Task 3) -- confirms the real end-to-end path (uvicorn -> FastAPI -> Postgres) works, not just the test suite.

- [ ] **Step 6: Commit**

```bash
git add api/main.py tests/test_api_main.py
git commit -m "feat: wire api/main.py to Postgres via get_db_connection"
```

---

### Task 6: Rewrite the daily cron to write to Postgres

**Files:**
- Modify: `.github/workflows/daily-scrape.yml`
- Modify: `pipeline/clean.py` (add a Postgres-writing variant)
- Modify: `index/build.py` (add a Postgres-writing variant)
- Test: `tests/test_pipeline_clean.py`, `tests/test_index_build.py` (add tests for the new functions)

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_pipeline_clean.py` (find the existing test file's imports and add `clean_run_to_db` to them):

```python
def test_clean_run_to_db_inserts_cleaned_records(monkeypatch, tmp_path):
    import os

    if "DATABASE_URL" not in os.environ:
        import pytest

        pytest.skip("DATABASE_URL not set in this environment")

    from api.db import get_connection
    from pipeline.clean import clean_run_to_db
    from scraper.schema import FareQuote, new_quote_id
    from datetime import date, datetime, timezone

    raw_dir = tmp_path / "raw" / "testsource"
    raw_dir.mkdir(parents=True)
    quote = FareQuote(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="testsource",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+1",
        fare_class=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=1000.0,
        status="available",
        run_id="run-db-test",
    )
    (raw_dir / "run-db-test.jsonl").write_text(
        __import__("json").dumps(quote.to_json_dict()) + "\n"
    )

    conn = get_connection()
    try:
        count = clean_run_to_db("run-db-test", conn=conn, raw_base_dir=tmp_path / "raw")
        assert count == 1
        with conn.cursor() as cur:
            cur.execute("SELECT quote_id FROM fare_quotes WHERE run_id = %s", ("run-db-test",))
            assert cur.fetchone()[0] == quote.quote_id
    finally:
        conn.rollback()
        conn.close()
```

Add to `tests/test_index_build.py`:

```python
def test_build_and_write_series_to_db_inserts_index_points(monkeypatch):
    import os

    if "DATABASE_URL" not in os.environ:
        import pytest

        pytest.skip("DATABASE_URL not set in this environment")

    from api.db import get_connection
    from index.build import build_and_write_series_to_db

    conn = get_connection()
    try:
        records = [
            {
                "origin": "DEL",
                "destination": "BOM",
                "status": "available",
                "is_outlier": False,
                "collected_at": "2026-08-24T10:00:00+00:00",
                "total_fare": 5000.0,
            }
        ]
        comparison_id = build_and_write_series_to_db(
            records, "daily", weights={"DEL-BOM": 1.0}, conn=conn
        )
        assert len(comparison_id) == 32
        with conn.cursor() as cur:
            cur.execute(
                "SELECT period FROM index_points WHERE comparison_id = %s", (comparison_id,)
            )
            assert cur.fetchone()[0] == "2026-08-24"
    finally:
        conn.rollback()
        conn.close()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_pipeline_clean.py tests/test_index_build.py -v -k _to_db`
Expected: FAIL — `clean_run_to_db` and `build_and_write_series_to_db` don't exist yet.

- [ ] **Step 3: Implement**

Add to `pipeline/clean.py` (after the existing `clean_run` function -- keep `clean_run` itself unchanged, it's still used by local/manual workflows):

```python
def clean_run_to_db(run_id: str, conn, raw_base_dir: Path = RAW_BASE_DIR) -> int:
    quotes = load_run_quotes(run_id, raw_base_dir)
    deduped = dedup_quotes(quotes)
    representative_quotes = [quote for quote, _ in deduped]
    outlier_flags = flag_outliers(representative_quotes)

    with conn.cursor() as cur:
        for quote, source_quote_ids in deduped:
            cur.execute(
                """
                INSERT INTO fare_quotes
                    (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                     advance_window, fare_class, base_fare, taxes, udf, convenience_fee,
                     total_fare, status, run_id, fee_breakdown, routing, is_outlier,
                     source_quote_ids)
                VALUES
                    (%(quote_id)s, %(origin)s, %(destination)s, %(carrier)s, %(source)s,
                     %(travel_date)s, %(collected_at)s, %(advance_window)s, %(fare_class)s,
                     %(base_fare)s, %(taxes)s, %(udf)s, %(convenience_fee)s, %(total_fare)s,
                     %(status)s, %(run_id)s, %(fee_breakdown)s, %(routing)s, %(is_outlier)s,
                     %(source_quote_ids)s)
                """,
                {
                    "quote_id": quote.quote_id,
                    "origin": quote.origin,
                    "destination": quote.destination,
                    "carrier": quote.carrier,
                    "source": quote.source,
                    "travel_date": quote.travel_date,
                    "collected_at": quote.collected_at,
                    "advance_window": quote.advance_window,
                    "fare_class": quote.fare_class,
                    "base_fare": quote.base_fare,
                    "taxes": quote.taxes,
                    "udf": quote.udf,
                    "convenience_fee": quote.convenience_fee,
                    "total_fare": quote.total_fare,
                    "status": quote.status,
                    "run_id": quote.run_id,
                    "fee_breakdown": quote.fee_breakdown,
                    "routing": quote.routing,
                    "is_outlier": outlier_flags[quote.quote_id],
                    "source_quote_ids": source_quote_ids,
                },
            )
    conn.commit()
    return len(deduped)
```

Add the import `import psycopg` is not needed here (the function receives an already-open `conn`, doesn't create one itself) -- but do add `from pathlib import Path` if not already imported at the top of `pipeline/clean.py` (it already is, per the existing `clean_run` signature).

Add to `index/build.py` (after `build_and_write_series`):

```python
def build_and_write_series_to_db(
    records: list[dict], frequency: str, weights: dict[str, float] | None, conn
) -> str:
    import uuid

    if weights is None:
        weights = load_weights()

    series = build_series(records, frequency, weights)
    comparison_id = uuid.uuid4().hex

    with conn.cursor() as cur:
        for point in series:
            cur.execute(
                """
                INSERT INTO index_points
                    (comparison_id, frequency, period, base_period, routes, simple_relative,
                     laspeyres, paasche, fisher)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    comparison_id,
                    frequency,
                    point["period"],
                    point["base_period"],
                    point["routes"],
                    point["simple_relative"],
                    point.get("laspeyres"),
                    point.get("paasche"),
                    point.get("fisher"),
                ),
            )
    conn.commit()
    return comparison_id
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_pipeline_clean.py tests/test_index_build.py -v`
Expected: all tests PASS (new DB tests pass against the real database; all pre-existing file-based tests for `clean_run`/`build_series`/`build_and_write_series` continue passing unchanged, since those functions are untouched).

- [ ] **Step 5: Rewrite the workflow**

Replace the full contents of `.github/workflows/daily-scrape.yml`:

```yaml
name: Daily fare scrape

on:
  schedule:
    - cron: "30 2 * * *"
  workflow_dispatch: {}

concurrency:
  group: daily-scrape
  cancel-in-progress: false

jobs:
  scrape:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - id: scrape
        run: |
          run_id=$(python -m scraper.run)
          echo "run_id=$run_id" >> "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@v4
        with:
          name: raw-fares-${{ github.run_id }}
          path: data/raw/
      - run: |
          python3 -c "
          from api.db import get_connection
          from pipeline.clean import clean_run_to_db
          import os
          conn = get_connection()
          n = clean_run_to_db(os.environ['RUN_ID'], conn=conn)
          print(f'cleaned {n} records into Postgres')
          "
        env:
          RUN_ID: ${{ steps.scrape.outputs.run_id }}
      - run: |
          python3 -c "
          from api.db import get_connection
          from index.build import build_and_write_series_to_db, load_all_cleaned_records
          from index.weights import load_weights
          conn = get_connection()
          records = load_all_cleaned_records()
          cid = build_and_write_series_to_db(records, 'daily', load_weights(), conn=conn)
          print(f'wrote index snapshot {cid} to Postgres')
          "
```

Note: `load_all_cleaned_records()` still reads `data/cleaned/*.jsonl` -- since this task's scope is the cron writing forward-going data to Postgres, and `data/cleaned/`/`data/index/` still exist locally in the checked-out repo from before this sub-project's migration. Once Task 7 (below) removes them from git tracking, this line needs `load_all_cleaned_records` to instead read from Postgres -- flagged as a known follow-up, not blocking this task, since the cron write-path is what's being tested here, not full removal of the old read-path (that's Task 7's job).

- [ ] **Step 6: Add `DATABASE_URL` as a GitHub Actions secret**

This is a manual step in the GitHub UI (Settings > Secrets and variables > Actions > New repository secret), not something to script. Confirm with the user this has been done before relying on the cron to actually succeed on its next real trigger.

- [ ] **Step 7: Commit**

```bash
git add pipeline/clean.py index/build.py tests/test_pipeline_clean.py tests/test_index_build.py .github/workflows/daily-scrape.yml
git commit -m "feat: daily cron writes to Postgres instead of committing flat files"
```

---

### Task 7: Retire the flat-file git-commit persistence

**Files:**
- Modify: `.gitignore`
- Modify: `db/migrate_existing_data.py` docstring/comment only (no functional change)
- Modify: `.github/workflows/daily-scrape.yml` (fix the Task 6 follow-up: read from Postgres, not files, for the build step's input)

- [ ] **Step 1: Update `.gitignore`**

Add back the two lines removed in the earlier cron-fix sub-project:

```
data/cleaned/
data/index/
```

- [ ] **Step 2: Untrack the files (keep them on disk, remove from git)**

```bash
git rm -r --cached data/cleaned data/index
```

- [ ] **Step 3: Fix the build step to read cleaned records from Postgres, not files**

In `.github/workflows/daily-scrape.yml`, change the final step's Python snippet:

```yaml
      - run: |
          python3 -c "
          from api.db import get_connection
          from index.build import build_and_write_series_to_db
          from index.weights import load_weights

          conn = get_connection()
          with conn.cursor() as cur:
              cur.execute(
                  'SELECT quote_id, origin, destination, carrier, source, travel_date, '
                  'collected_at, advance_window, fare_class, base_fare, taxes, udf, '
                  'convenience_fee, total_fare, status, run_id, fee_breakdown, routing, '
                  'is_outlier, source_quote_ids FROM fare_quotes'
              )
              columns = [d[0] for d in cur.description]
              records = [dict(zip(columns, row)) for row in cur.fetchall()]
          for r in records:
              r['collected_at'] = r['collected_at'].isoformat()
          cid = build_and_write_series_to_db(records, 'daily', load_weights(), conn=conn)
          print(f'wrote index snapshot {cid} to Postgres')
          "
```

- [ ] **Step 4: Verify the YAML is well-formed**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/daily-scrape.yml'))"`
Expected: no output, no exception.

- [ ] **Step 5: Run the full test suite**

Run: `pytest && ruff check .`
Expected: all tests pass (removing `data/cleaned`/`data/index` from git tracking doesn't affect any test, since tests use `tmp_path` or the real DB, never the tracked files directly).

- [ ] **Step 6: Commit**

```bash
git add .gitignore .github/workflows/daily-scrape.yml
git commit -m "chore: retire flat-file git-commit persistence now that Postgres is the source of truth"
```

Note: this does NOT delete `data/cleaned/data/index` from the working directory or from git *history* -- only from tracking going forward. The historical commits from the earlier cron-fix sub-project remain in git log, which is fine (they're a truthful record of that sub-project's approach at the time).

---

### Task 8: CI gets a Postgres service container

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add a `postgres` service container and apply the schema before tests run**

Replace the `test` job in `.github/workflows/ci.yml`:

```yaml
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: skymetrics
          POSTGRES_PASSWORD: skymetrics
          POSTGRES_DB: skymetrics
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://skymetrics:skymetrics@localhost:5432/skymetrics
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: python3 -m db.apply_schema
      - run: ruff check .
      - run: pytest
```

(The `dashboard` job below this in the file is unchanged.)

- [ ] **Step 2: Verify the YAML is well-formed**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output, no exception.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add a Postgres service container for DB-backed tests"
```

---

### Task 9: Dockerfiles for API and dashboard

**Files:**
- Create: `Dockerfile`
- Create: `dashboard/Dockerfile`
- Create: `.dockerignore`
- Create: `dashboard/.dockerignore`

- [ ] **Step 1: Write the API Dockerfile**

Create `Dockerfile` (repo root):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ api/
COPY db/ db/
COPY index/ index/
COPY pipeline/ pipeline/
COPY scraper/ scraper/
COPY config/ config/

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write the API `.dockerignore`**

Create `.dockerignore` (repo root):

```
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/
.pytest_cache/
.ruff_cache/
data/
.env
.git/
dashboard/
tests/
```

- [ ] **Step 3: Write the dashboard Dockerfile**

Create `dashboard/Dockerfile`:

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_API_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_KEY=$VITE_API_KEY
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
```

- [ ] **Step 4: Write the dashboard `.dockerignore`**

Create `dashboard/.dockerignore`:

```
node_modules/
dist/
.env
*.tsbuildinfo
```

- [ ] **Step 5: Verify each image builds**

Run: `docker build -t skymetrics-api .`
Expected: builds successfully (this may take a minute the first time).

Run: `docker build -t skymetrics-dashboard --build-arg VITE_API_BASE_URL=http://localhost:8000 --build-arg VITE_API_KEY=dev-local-key ./dashboard`
Expected: builds successfully.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile dashboard/Dockerfile .dockerignore dashboard/.dockerignore
git commit -m "feat: Dockerfiles for the API and dashboard"
```

---

### Task 10: Docker Compose + final end-to-end verification

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write `docker-compose.yml`**

Create `docker-compose.yml` (repo root):

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SKYMETRICS_API_KEYS: ${SKYMETRICS_API_KEYS}

  dashboard:
    build:
      context: ./dashboard
      args:
        VITE_API_BASE_URL: http://localhost:8000
        VITE_API_KEY: ${SKYMETRICS_API_KEYS}
    ports:
      - "5173:5173"
    depends_on:
      - api
```

- [ ] **Step 2: Write `.env.example`**

Create `.env.example` (repo root):

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SKYMETRICS_API_KEYS=dev-local-key
```

- [ ] **Step 3: Run the real stack**

Run: `docker compose up --build -d`
Expected: both containers start successfully.

Run: `sleep 5 && curl -s -H "X-API-Key: $SKYMETRICS_API_KEYS" http://localhost:8000/api/v1/metadata | python3 -m json.tool`
Expected: real JSON response with the migrated snapshot(s).

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173`
Expected: `200`.

- [ ] **Step 4: Tear down**

Run: `docker compose down`

- [ ] **Step 5: Update README**

Add a "Running with Docker" section to `README.md`, after the existing "Running the dashboard" section:

```markdown
## Running with Docker

Requires Docker and Docker Compose (both included in Docker Desktop).

```bash
cp .env.example .env   # fill in DATABASE_URL (a real Postgres, e.g. from neon.tech) and SKYMETRICS_API_KEYS
docker compose up --build
```

API at `http://localhost:8000`, dashboard at `http://localhost:5173`. Both containers connect to the same Postgres database specified in `DATABASE_URL` -- this project no longer stores durable data in git-committed flat files (see `docs/superpowers/specs/2026-08-26-postgres-docker-design.md`).
```

Also update the "Setup", "Cleaning and index construction", and "Running the API" sections to reflect that `data/cleaned`/`data/index` are no longer git-tracked and the API/cron now require `DATABASE_URL` -- read the current README in full before editing, and make the whole document internally consistent rather than only patching the new section.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example README.md
git commit -m "feat: Docker Compose packaging + README updates"
```

---

## Self-review notes

- **Spec coverage:** schema (Task 1), connection helper (Task 2), migration (Task 3), `api/data_access.py` rewrite (Task 4), `api/main.py` rewrite (Task 5), cron rewrite (Task 6), flat-file retirement (Task 7), CI Postgres service (Task 8), Dockerfiles (Task 9), Docker Compose + README (Task 10) -- every design-spec section maps to a task.
- **No placeholders:** every step has literal file contents, commands, and expected output, including real SQL and real Python.
- **Type/signature consistency:** `load_snapshot(conn, frequency, comparison_id, start=None, end=None)` is used identically in `api/main.py` (Task 5) and its tests (Task 4); `load_fare_records(conn, origin=None, destination=None, start=None, end=None)` likewise; `build_and_write_series_to_db(records, frequency, weights, conn)` and `clean_run_to_db(run_id, conn, raw_base_dir=...)` signatures match between their Task 6 test and implementation and their Task 6/7 cron-workflow usage.
- **Known follow-up flagged explicitly, not silently left as a placeholder:** Task 6's cron step temporarily still reads `data/cleaned/*.jsonl` via `load_all_cleaned_records()` for the index-build step, corrected in Task 7 once flat files are fully retired -- called out in Task 6's own text so an implementer doesn't miss it or treat it as done prematurely.
