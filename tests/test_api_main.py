import json
import os

os.environ["SKYMETRICS_API_KEYS"] = "test-key-123"

import pytest
from fastapi.testclient import TestClient

from api import rate_limit
from api.main import app, get_cleaned_base_dir, get_index_base_dir, get_weights_path
from api.rate_limit import RateLimiter

client = TestClient(app)
HEADERS = {"X-API-Key": "test-key-123"}


@pytest.fixture(autouse=True)
def _fresh_rate_limiter():
    rate_limit.limiter = RateLimiter()


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def _write_snapshot(index_dir, comparison_id, frequency, series):
    path = index_dir / f"{comparison_id}.json"
    path.write_text(
        json.dumps({"comparison_id": comparison_id, "frequency": frequency, "series": series})
    )


def test_get_index_returns_latest_snapshot(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    _write_snapshot(
        index_dir, "abc123", "daily", [{"period": "2026-08-24", "simple_relative": 100.0}]
    )
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["comparison_id"] == "abc123"
    assert body["series"] == [{"period": "2026-08-24", "simple_relative": 100.0}]


def test_get_index_by_comparison_id(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    _write_snapshot(index_dir, "target", "weekly", [{"period": "2026-W34"}])
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    response = client.get(
        "/api/v1/index", params={"frequency": "weekly", "comparison_id": "target"}, headers=HEADERS
    )

    assert response.status_code == 200
    assert response.json()["comparison_id"] == "target"


def test_get_index_filters_by_start_and_end(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    _write_snapshot(
        index_dir,
        "abc",
        "daily",
        [{"period": "2026-08-01"}, {"period": "2026-08-15"}, {"period": "2026-08-30"}],
    )
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    response = client.get(
        "/api/v1/index",
        params={"frequency": "daily", "start": "2026-08-10", "end": "2026-08-20"},
        headers=HEADERS,
    )

    assert [p["period"] for p in response.json()["series"]] == ["2026-08-15"]


def test_get_index_returns_404_when_no_snapshot_for_frequency(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 404


def test_get_index_returns_404_for_unknown_comparison_id(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    response = client.get(
        "/api/v1/index", params={"frequency": "daily", "comparison_id": "nope"}, headers=HEADERS
    )

    assert response.status_code == 404


def test_get_index_rejects_invalid_frequency(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    response = client.get("/api/v1/index", params={"frequency": "yearly"}, headers=HEADERS)

    assert response.status_code == 422


def test_get_fares_filters_by_origin_and_destination(tmp_path):
    cleaned_dir = tmp_path / "cleaned"
    cleaned_dir.mkdir()
    records = [
        {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-24T10:00:00+00:00"},
        {"origin": "DEL", "destination": "BLR", "collected_at": "2026-08-24T10:00:00+00:00"},
    ]
    (cleaned_dir / "run1.jsonl").write_text("\n".join(json.dumps(r) for r in records) + "\n")
    app.dependency_overrides[get_cleaned_base_dir] = lambda: cleaned_dir

    response = client.get(
        "/api/v1/fares", params={"origin": "DEL", "destination": "BOM"}, headers=HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["destination"] == "BOM"


def test_get_fares_rejects_a_malformed_date(tmp_path):
    cleaned_dir = tmp_path / "cleaned"
    cleaned_dir.mkdir()
    app.dependency_overrides[get_cleaned_base_dir] = lambda: cleaned_dir

    response = client.get("/api/v1/fares", params={"start": "not-a-date"}, headers=HEADERS)

    assert response.status_code == 422


def test_get_metadata_returns_weights_and_snapshots(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    _write_snapshot(index_dir, "abc", "daily", [])
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
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir
    app.dependency_overrides[get_weights_path] = lambda: weights_path

    response = client.get("/api/v1/metadata", headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["weights"]["source"] == "test"
    assert body["weights"]["weights"] == {"DEL-BOM": 0.5}
    assert len(body["snapshots"]) == 1
    assert body["snapshots"][0]["comparison_id"] == "abc"
    assert "laspeyres" in body["formulas"]


def test_missing_api_key_returns_401():
    response = client.get("/api/v1/metadata")

    assert response.status_code == 401


def test_wrong_api_key_returns_401():
    response = client.get("/api/v1/metadata", headers={"X-API-Key": "wrong-key"})

    assert response.status_code == 401


def test_rate_limit_exceeded_returns_429(tmp_path):
    rate_limit.limiter = RateLimiter(max_requests=1, window_seconds=60.0)
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)
    response = client.get("/api/v1/index", params={"frequency": "daily"}, headers=HEADERS)

    assert response.status_code == 429


def test_invalid_api_key_returns_401_even_when_rate_limited(tmp_path):
    # Auth must run before rate limiting: a caller with a bad key gets a
    # clean 401, never a 429, even if that same key string has already
    # exhausted the rate limit -- otherwise an unauthenticated caller could
    # fingerprint the rate limiter's internal state through the response code.
    rate_limit.limiter = RateLimiter(max_requests=1, window_seconds=60.0)
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    app.dependency_overrides[get_index_base_dir] = lambda: index_dir

    client.get("/api/v1/index", params={"frequency": "daily"}, headers={"X-API-Key": "wrong-key"})
    response = client.get(
        "/api/v1/index", params={"frequency": "daily"}, headers={"X-API-Key": "wrong-key"}
    )

    assert response.status_code == 401


def test_openapi_docs_reachable_without_api_key():
    response = client.get("/openapi.json")

    assert response.status_code == 200
