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
