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
            (
                comparison_id,
                frequency,
                period,
                kwargs.get("base_period", period),
                ["ZZZ-YYY"],
                100.0,
            ),
        )
    # No conn.commit() here, deliberately: get_db_connection is overridden
    # to yield this exact same connection object to the FastAPI endpoint, so
    # the insert is already visible to it within the same open transaction
    # (read-your-own-writes) -- committing would make the fixture's
    # rollback() teardown a no-op, permanently leaking test rows into the
    # real database (this is exactly what happened before this comment was
    # added: a stray quote_id='q1' row survived a full-suite run and broke
    # a later run with a UniqueViolation).


def test_get_index_returns_latest_snapshot(db_conn):
    _insert_index_point(db_conn, "abc12300000000000000000000000000"[:32], "daily", "2026-08-24")

    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["series"][0]["period"] == "2026-08-24"


def test_get_index_returns_simple_relative_as_a_json_number_not_a_string(db_conn):
    # Regression test: Postgres NUMERIC -> psycopg3 Decimal -> FastAPI's bare
    # `-> dict` return annotation on get_index used to make Pydantic
    # serialize Decimal as a JSON string (e.g. "100" instead of 100.0).
    # json.loads (what response.json() uses under the hood) preserves that
    # distinction -- a JSON string round-trips to a Python str, a JSON
    # number to a Python float -- so a type check here catches what an
    # equality check like `== 100.0` would miss (Decimal("100") == 100.0
    # is True even though the Decimal isn't a float).
    _insert_index_point(db_conn, "abc12300000000000000000000000000"[:32], "daily", "2026-08-24")

    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 200
    value = response.json()["series"][0]["simple_relative"]
    assert isinstance(value, float), f"simple_relative is {type(value)}, expected float"


def test_get_index_returns_404_when_no_snapshot_for_frequency(db_conn):
    # "weekly" -- see the same-name note in tests/test_api_data_access.py:
    # real committed migration data has real "daily" rows in this shared
    # database, so a "no daily snapshot exists" premise would be false here.
    response = client.get("/api/v1/index", params={"frequency": "weekly"}, headers=HEADERS)

    assert response.status_code == 404


def test_get_index_rejects_invalid_frequency(db_conn):
    response = client.get("/api/v1/index", params={"frequency": "yearly"}, headers=HEADERS)

    assert response.status_code == 422


def test_get_fares_filters_by_origin_and_destination(db_conn):
    # ZZZ/YYY -- see the same-name note in tests/test_api_data_access.py:
    # avoids colliding with real migrated fare data on real routes.
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fare_quotes
                (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                 advance_window, status, run_id, is_outlier, source_quote_ids)
            VALUES ('q1', 'ZZZ', 'YYY', 'QP', 'akasaair', '2026-09-01',
                    '2026-08-24T10:00:00+00:00', 'T+1', 'available', 'run1', false, ARRAY['q1'])
            """
        )
    # No db_conn.commit() here -- see the comment in _insert_index_point above.

    response = client.get(
        "/api/v1/fares", params={"origin": "ZZZ", "destination": "YYY"}, headers=HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["destination"] == "YYY"


def test_get_fares_returns_total_fare_as_a_json_number_not_a_string(db_conn):
    # Regression test -- see test_get_index_returns_simple_relative_as_a_
    # json_number_not_a_string above for why this bug slips past equality
    # checks. This one matters more in practice: dashboard/src/components/
    # SectorHeatmap.tsx and LeadTimeElasticity.tsx both aggregate fares with
    # `existing.sum += record.total_fare` -- if total_fare arrives as a JSON
    # string, that `+=` silently does string concatenation, not addition.
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fare_quotes
                (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                 advance_window, status, run_id, is_outlier, source_quote_ids, total_fare)
            VALUES ('q1', 'ZZZ', 'YYY', 'QP', 'akasaair', '2026-09-01',
                    '2026-08-24T10:00:00+00:00', 'T+1', 'available', 'run1', false, ARRAY['q1'],
                    7388.0)
            """
        )
    # No db_conn.commit() here -- see the comment in _insert_index_point above.

    response = client.get(
        "/api/v1/fares", params={"origin": "ZZZ", "destination": "YYY"}, headers=HEADERS
    )

    assert response.status_code == 200
    value = response.json()[0]["total_fare"]
    assert isinstance(value, float), f"total_fare is {type(value)}, expected float"


def test_get_fares_rejects_a_malformed_date(db_conn):
    response = client.get("/api/v1/fares", params={"start": "not-a-date"}, headers=HEADERS)

    assert response.status_code == 422


def test_get_metadata_returns_weights_and_snapshots(db_conn, tmp_path):
    import json

    _insert_index_point(db_conn, "abc12300000000000000000000000000"[:32], "daily", "2026-08-24")
    weights_path = tmp_path / "weights.json"
    weights_path.write_text(
        json.dumps(
            {
                "source": "test",
                "period": "2025",
                "computed_at": "2026-08-24",
                "weights": {"DEL-BOM": 0.5},
            }
        )
    )
    app.dependency_overrides[get_weights_path] = lambda: weights_path

    response = client.get("/api/v1/metadata", headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["weights"]["weights"] == {"DEL-BOM": 0.5}
    assert len(body["snapshots"]) >= 1
    assert "laspeyres" in body["formulas"]


def test_missing_api_key_returns_401():
    response = client.get("/api/v1/metadata")

    assert response.status_code == 401


def test_wrong_api_key_returns_401():
    response = client.get("/api/v1/metadata", headers={"X-API-Key": "wrong-key"})

    assert response.status_code == 401


def test_invalid_api_key_returns_401_even_when_rate_limited():
    rate_limit.limiter = RateLimiter(max_requests=1, window_seconds=60.0)

    client.get("/api/v1/metadata", headers={"X-API-Key": "wrong-key"})
    response = client.get("/api/v1/metadata", headers={"X-API-Key": "wrong-key"})

    assert response.status_code == 401


def test_rate_limit_exceeded_returns_429(db_conn):
    rate_limit.limiter = RateLimiter(max_requests=1, window_seconds=60.0)

    client.get("/api/v1/index", params={"frequency": "weekly"}, headers=HEADERS)
    response = client.get("/api/v1/index", params={"frequency": "weekly"}, headers=HEADERS)

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


def test_cors_preflight_from_other_origin_is_not_allowed():
    response = client.options(
        "/api/v1/metadata",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-API-Key",
        },
    )

    assert "access-control-allow-origin" not in response.headers
