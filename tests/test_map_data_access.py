import os
from decimal import Decimal

import pytest
from fastapi import HTTPException

from api.data_access import load_map_routes
from api.routers.map import _validate_map_origin_city, _validate_map_routes


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn
        self.rows = []
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        params = params or []
        if "FROM map_city_nodes" in query:
            self.rows = []
            self.row = None
        elif query.startswith("SELECT snapshot_id, period"):
            self.rows = []
            self.row = self.conn.snapshot_row
        else:
            self.conn.route_query = query
            self.conn.route_params = params
            self.rows = [
                (
                    "snapshot-1",
                    "daily",
                    "2026-08-24",
                    "2026-08-01",
                    "AAA",
                    "BBB",
                    "AAA-BBB",
                    Decimal("108.5"),
                    12,
                    11,
                    1,
                    2,
                    self.conn.written_at,
                ),
                (
                    "snapshot-1",
                    "daily",
                    "2026-08-24",
                    "2026-08-01",
                    "BBB",
                    "AAA",
                    "BBB-AAA",
                    Decimal("99.0"),
                    8,
                    8,
                    0,
                    1,
                    self.conn.written_at,
                ),
            ]
            self.row = None

    def fetchall(self):
        return self.rows

    def fetchone(self):
        return self.row


class FakeConn:
    def __init__(self):
        from datetime import datetime, timezone

        self.route_params = None
        self.route_query = ""
        self.written_at = datetime(2026, 8, 24, tzinfo=timezone.utc)
        self.snapshot_row = ("snapshot-1", "2026-08-24")

    def cursor(self):
        return FakeCursor(self)


def test_load_map_routes_groups_bidirectional_cpi_edges():
    conn = FakeConn()

    result = load_map_routes(conn, "daily", routes=["AAA-BBB"])

    assert "nodes" not in result
    assert conn.route_params[-1] == ["AAA-BBB", "BBB-AAA"]
    assert result["is_preview"] is False
    edge = result["edges"][0]
    assert edge["edge_key"] == "AAA|BBB"
    assert edge["city_a_to_b"]["origin_city_code"] == "AAA"
    assert edge["city_b_to_a"]["origin_city_code"] == "BBB"
    assert isinstance(edge["city_a_to_b"]["cpi"], float)


def test_load_map_routes_flags_a_demo_snapshot_as_preview():
    conn = FakeConn()
    conn.snapshot_row = ("demo-map-daily-2026-08-27", "2026-08-27")

    result = load_map_routes(conn, "daily", preview=True)

    assert result["is_preview"] is True


def test_load_map_routes_can_filter_by_clicked_origin_city():
    conn = FakeConn()

    load_map_routes(conn, "daily", origin_city="AAA")

    assert "origin_city_code = %s OR destination_city_code = %s" in conn.route_query
    assert conn.route_params[-2:] == ["AAA", "AAA"]


def test_map_route_validator_rejects_malformed_route():
    with pytest.raises(HTTPException) as exc:
        _validate_map_routes(["DEL/BOM"])

    assert exc.value.status_code == 422


def test_map_origin_city_validator_rejects_malformed_city_code():
    with pytest.raises(HTTPException) as exc:
        _validate_map_origin_city("DELHI")

    assert exc.value.status_code == 422


pytestmark_real_db = pytest.mark.skipif(
    "DATABASE_URL" not in os.environ, reason="DATABASE_URL not set in this environment"
)


@pytest.fixture
def real_conn():
    # Self-contained: inserts its own fixture row and rolls back, rather
    # than depending on the shared dev DB's manually-seeded demo-map-*
    # rows (db/seed_map_dummy.sql) existing -- those aren't present in a
    # fresh CI database, so a test that assumed they were there would pass
    # locally and fail in CI.
    from api.db import get_connection

    connection = get_connection()
    yield connection
    connection.rollback()
    connection.close()


def _insert_demo_map_edge(conn, snapshot_id):
    # ZZQ/ZZR (not real city codes) deliberately, matching this codebase's
    # existing test-isolation convention (see test_api_data_access.py's
    # ZZZ/YYY fare_quotes fixtures) -- avoids colliding with real rows in
    # the shared dev database this also runs against.
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO map_city_nodes (city_code, city_name, latitude, longitude, airport_codes)
            VALUES ('ZZQ', 'Test City Q', 0, 0, ARRAY['ZZQ']),
                   ('ZZR', 'Test City R', 0, 0, ARRAY['ZZR'])
            """
        )
        cur.execute(
            """
            INSERT INTO map_route_cpi_edges
                (snapshot_id, frequency, period, base_period, origin_city_code,
                 destination_city_code, route_key, cpi, quote_count, available_count,
                 no_flight_count, source_count)
            VALUES (%s, 'daily', '2026-08-27', '2025-08-27', 'ZZQ', 'ZZR', 'ZZQ-ZZR',
                    121.0, 10, 10, 0, 1)
            """,
            (snapshot_id,),
        )


@pytestmark_real_db
def test_load_map_routes_never_serves_a_demo_snapshot_even_if_explicitly_requested(real_conn):
    _insert_demo_map_edge(real_conn, "demo-test-fixture")

    result = load_map_routes(real_conn, "daily", snapshot_id="demo-test-fixture")

    assert result["is_preview"] is False
    assert result["snapshot_id"] is None or result["snapshot_id"] != "demo-test-fixture"
    assert result["edges"] == []


@pytestmark_real_db
def test_load_map_routes_preview_true_surfaces_a_demo_snapshot_labeled(real_conn):
    _insert_demo_map_edge(real_conn, "demo-test-fixture")

    result = load_map_routes(real_conn, "daily", snapshot_id="demo-test-fixture", preview=True)

    assert result["snapshot_id"] == "demo-test-fixture"
    assert result["is_preview"] is True
    assert result["edges"][0]["city_a_to_b"]["cpi"] == 121.0
