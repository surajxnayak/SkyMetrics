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
            self.row = ("snapshot-1", "2026-08-24")
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

    def cursor(self):
        return FakeCursor(self)


def test_load_map_routes_groups_bidirectional_cpi_edges():
    conn = FakeConn()

    result = load_map_routes(conn, "daily", routes=["AAA-BBB"])

    assert "nodes" not in result
    assert conn.route_params[-1] == ["AAA-BBB", "BBB-AAA"]
    edge = result["edges"][0]
    assert edge["edge_key"] == "AAA|BBB"
    assert edge["city_a_to_b"]["origin_city_code"] == "AAA"
    assert edge["city_b_to_a"]["origin_city_code"] == "BBB"
    assert isinstance(edge["city_a_to_b"]["cpi"], float)


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
