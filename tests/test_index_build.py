import json
import os
from datetime import datetime, timezone

import pytest

from index.build import (
    build_and_write_series,
    build_and_write_series_to_db,
    build_series,
    load_all_cleaned_records,
)

DAY1 = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
DAY2 = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc)
WEIGHTS = {"DEL-BOM": 0.4331, "DEL-BLR": 0.3061, "BOM-BLR": 0.2608}


def _record(origin, destination, total_fare, collected_at, status="available", is_outlier=False):
    return {
        "origin": origin,
        "destination": destination,
        "total_fare": total_fare,
        "collected_at": collected_at.isoformat(),
        "status": status,
        "is_outlier": is_outlier,
    }


def test_build_series_first_period_is_its_own_base():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("DEL", "BLR", 7000.0, DAY1),
        _record("BOM", "BLR", 5000.0, DAY1),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert len(series) == 1
    assert series[0]["period"] == "2026-08-24"
    assert series[0]["base_period"] == "2026-08-24"
    assert series[0]["simple_relative"] == pytest.approx(100.0)
    assert series[0]["laspeyres"] == pytest.approx(100.0)
    assert series[0]["paasche"] == pytest.approx(100.0)


def test_build_series_computes_a_real_second_point():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("DEL", "BLR", 7000.0, DAY1),
        _record("BOM", "BLR", 5000.0, DAY1),
        _record("DEL", "BOM", 6600.0, DAY2),
        _record("DEL", "BLR", 7000.0, DAY2),
        _record("BOM", "BLR", 5500.0, DAY2),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert [point["period"] for point in series] == ["2026-08-24", "2026-08-25"]
    day2_point = series[1]
    assert day2_point["base_period"] == "2026-08-24"
    assert day2_point["simple_relative"] == pytest.approx(106.66666666666667)
    # Laspeyres (arithmetic mean of relatives) and Paasche (harmonic mean)
    # genuinely differ here even with identical weights, because the price
    # relatives (1.1, 1.0, 1.1) aren't all equal -- see index/formulas.py's
    # docstring. Laspeyres > Paasche always holds except in that degenerate
    # equal-relatives case (AM >= HM).
    assert day2_point["laspeyres"] == pytest.approx(106.939)
    assert day2_point["paasche"] == pytest.approx(106.73290575484423)
    assert day2_point["laspeyres"] > day2_point["paasche"]
    assert day2_point["fisher"] == pytest.approx(106.83590318108087)


def test_build_series_falls_back_to_simple_relative_when_a_route_has_no_weight():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("XXX", "YYY", 1000.0, DAY1),
        _record("DEL", "BOM", 6600.0, DAY2),
        _record("XXX", "YYY", 1000.0, DAY2),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert "laspeyres" not in series[1]
    assert series[1]["simple_relative"] == pytest.approx(105.0)


def test_build_series_returns_empty_list_for_no_data():
    assert build_series([], "daily", WEIGHTS) == []


def test_build_series_skips_periods_with_no_common_routes_with_base():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("XXX", "YYY", 1000.0, DAY2),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert [point["period"] for point in series] == ["2026-08-24"]


def test_build_series_rejects_unknown_frequency_even_with_no_data():
    with pytest.raises(ValueError):
        build_series([], "yearly", WEIGHTS)


def test_load_all_cleaned_records_reads_every_file(tmp_path):
    file1 = tmp_path / "run1.jsonl"
    file2 = tmp_path / "run2.jsonl"
    file1.write_text(json.dumps(_record("DEL", "BOM", 6000.0, DAY1)) + "\n")
    file2.write_text(json.dumps(_record("DEL", "BOM", 6600.0, DAY2)) + "\n")

    records = load_all_cleaned_records(cleaned_base_dir=tmp_path)

    assert len(records) == 2


def test_build_and_write_series_writes_a_versioned_snapshot(tmp_path):
    cleaned_dir = tmp_path / "cleaned"
    index_dir = tmp_path / "index"
    cleaned_dir.mkdir()
    lines = [
        json.dumps(_record("DEL", "BOM", 6000.0, DAY1)),
        json.dumps(_record("DEL", "BLR", 7000.0, DAY1)),
        json.dumps(_record("BOM", "BLR", 5000.0, DAY1)),
    ]
    (cleaned_dir / "run1.jsonl").write_text("\n".join(lines) + "\n")

    out_path = build_and_write_series(
        frequency="daily", cleaned_base_dir=cleaned_dir, index_base_dir=index_dir, weights=WEIGHTS
    )

    assert out_path.parent == index_dir
    result = json.loads(out_path.read_text())
    assert result["frequency"] == "daily"
    assert len(result["series"]) == 1


def test_build_and_write_series_to_db_inserts_index_points():
    if "DATABASE_URL" not in os.environ:
        pytest.skip("DATABASE_URL not set in this environment")

    from api.db import get_connection

    conn = get_connection()
    comparison_id = None
    try:
        records = [_record("DEL", "BOM", 5000.0, DAY1)]
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
        # build_and_write_series_to_db commits internally (it's the real
        # production write path), so conn.rollback() alone can't undo it --
        # explicit cleanup is required to avoid leaving test data in the
        # real database.
        if comparison_id is not None:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM index_points WHERE comparison_id = %s", (comparison_id,))
            conn.commit()
        conn.close()
