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


def _insert_fare_quote(
    conn,
    quote_id,
    origin="ZZZ",
    destination="YYY",
    collected_at="2026-08-24T10:00:00+00:00",
    total_fare=None,
):
    # ZZZ/YYY (not real routes like DEL/BOM) deliberately -- the real
    # committed migration data (see db/migrate_existing_data.py) has real
    # rows on DEL-BOM/DEL-BLR/BOM-BLR in this shared database, so tests using
    # those same routes would count real rows alongside their own.
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fare_quotes
                (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                 advance_window, status, run_id, is_outlier, source_quote_ids, base_fare, taxes,
                 udf, convenience_fee, total_fare)
            VALUES
                (%s, %s, %s, 'QP', 'akasaair', '2026-09-01', %s, 'T+1', 'available', 'run1',
                 false, %s, %s, %s, %s, %s, %s)
            """,
            (
                quote_id,
                origin,
                destination,
                collected_at,
                [quote_id],
                total_fare,
                total_fare,
                total_fare,
                total_fare,
                total_fare,
            ),
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
    # "weekly" (not "daily") deliberately -- the real committed migration
    # data (see db/migrate_existing_data.py) has real "daily" rows in this
    # shared database, so querying "daily" here would find real data instead
    # of correctly finding nothing. No "weekly" data has ever been migrated.
    with pytest.raises(SnapshotNotFoundError):
        load_snapshot(conn, "weekly", comparison_id=None)


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
    _insert_index_point(
        conn, cid, "daily", "2026-08-01", laspeyres=105.0, paasche=104.0, fisher=104.5
    )

    result = load_snapshot(conn, "daily", comparison_id=cid)

    assert result["series"][0]["laspeyres"] == 105.0


def test_load_snapshot_returns_plain_floats_not_decimals(conn):
    # Postgres NUMERIC columns come back from psycopg3 as decimal.Decimal.
    # FastAPI's bare `-> dict` return annotation on get_index makes Pydantic
    # serialize an unrecognized type like Decimal as a JSON STRING instead of
    # a number (to avoid silent precision loss on an Any-typed field) --
    # `result["series"][0]["laspeyres"] == 105.0` above still passes even
    # when the value is a Decimal, because Decimal.__eq__ compares
    # numerically against float. Only a type check catches this.
    cid = "deadbeefdeadbeefdeadbeefdeadbeef"
    _insert_index_point(
        conn, cid, "daily", "2026-08-01", laspeyres=105.0, paasche=104.0, fisher=104.5
    )

    result = load_snapshot(conn, "daily", comparison_id=cid)
    point = result["series"][0]

    for key in ("simple_relative", "laspeyres", "paasche", "fisher"):
        assert isinstance(point[key], float), f"{key} is {type(point[key])}, expected float"


def test_load_fare_records_filters_by_origin_and_destination(conn):
    _insert_fare_quote(conn, "q1", origin="ZZZ", destination="YYY")
    _insert_fare_quote(conn, "q2", origin="ZZZ", destination="XXX")

    result = load_fare_records(conn, origin="ZZZ", destination="YYY")

    assert len(result) == 1
    assert result[0]["destination"] == "YYY"


def test_load_fare_records_filters_by_date_range_is_inclusive(conn):
    _insert_fare_quote(conn, "q1", collected_at="2026-08-24T10:00:00+00:00")
    _insert_fare_quote(conn, "q2", collected_at="2026-08-25T10:00:00+00:00")

    result = load_fare_records(
        conn, start="2026-08-24T10:00:00+00:00", end="2026-08-24T10:00:00+00:00"
    )

    assert len(result) == 1
    assert result[0]["quote_id"] == "q1"


def test_load_fare_records_accepts_a_naive_date_bound_widening_to_end_of_day(conn):
    # 2020-01-01 (not "today") deliberately -- a whole-day range on the same
    # date the real migration data was collected would also match every real
    # row from that day (see the ZZZ/YYY note on _insert_fare_quote above).
    _insert_fare_quote(conn, "q1", collected_at="2020-01-01T23:59:00+00:00")
    _insert_fare_quote(conn, "q2", collected_at="2020-01-02T00:01:00+00:00")

    result = load_fare_records(conn, start="2020-01-01", end="2020-01-01")

    assert len(result) == 1
    assert result[0]["quote_id"] == "q1"


def test_load_fare_records_rejects_a_malformed_date(conn):
    with pytest.raises(ValueError):
        load_fare_records(conn, start="not-a-date")


def test_load_fare_records_returns_plain_floats_not_decimals(conn):
    # Same Decimal-vs-float issue as test_load_snapshot_returns_plain_floats_
    # not_decimals above, but on fare_quotes' NUMERIC columns -- these feed
    # dashboard aggregations like `existing.sum += record.total_fare` in
    # SectorHeatmap.tsx/LeadTimeElasticity.tsx, which do string concatenation
    # instead of addition if total_fare arrives as a JSON string.
    _insert_fare_quote(conn, "q1", total_fare=7388.0)

    result = load_fare_records(conn, origin="ZZZ", destination="YYY")
    record = result[0]

    for key in ("base_fare", "taxes", "udf", "convenience_fee", "total_fare"):
        assert isinstance(record[key], float), f"{key} is {type(record[key])}, expected float"


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
