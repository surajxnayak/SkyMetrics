import json
import os
import time

import pytest

from api.data_access import (
    SnapshotNotFoundError,
    filter_fare_records,
    filter_series,
    list_snapshots,
    load_fare_records,
    load_snapshot,
    load_weights_metadata,
)


def _write_snapshot(index_dir, comparison_id, frequency, series):
    path = index_dir / f"{comparison_id}.json"
    path.write_text(
        json.dumps({"comparison_id": comparison_id, "frequency": frequency, "series": series})
    )
    return path


def test_list_snapshots_returns_newest_first(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    older = _write_snapshot(index_dir, "aaa", "daily", [])
    newer = _write_snapshot(index_dir, "bbb", "daily", [])
    now = time.time()
    os.utime(older, (now - 100, now - 100))
    os.utime(newer, (now, now))

    snapshots = list_snapshots(index_base_dir=index_dir)

    assert [s["comparison_id"] for s in snapshots] == ["bbb", "aaa"]


def test_load_snapshot_returns_newest_matching_frequency(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    older = _write_snapshot(index_dir, "old", "daily", [{"period": "2026-08-01"}])
    os.utime(older, (time.time() - 100, time.time() - 100))
    _write_snapshot(index_dir, "new", "daily", [{"period": "2026-08-02"}])

    result = load_snapshot("daily", comparison_id=None, index_base_dir=index_dir)

    assert result["comparison_id"] == "new"


def test_load_snapshot_by_comparison_id(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    comparison_id = "deadbeefdeadbeefdeadbeefdeadbeef"
    _write_snapshot(index_dir, comparison_id, "weekly", [{"period": "2026-W34"}])

    result = load_snapshot("weekly", comparison_id=comparison_id, index_base_dir=index_dir)

    assert result["comparison_id"] == comparison_id


def test_load_snapshot_raises_when_comparison_id_missing(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()

    with pytest.raises(SnapshotNotFoundError):
        load_snapshot("daily", comparison_id="nope", index_base_dir=index_dir)


def test_load_snapshot_raises_when_comparison_id_frequency_mismatch(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    _write_snapshot(index_dir, "target", "weekly", [])

    with pytest.raises(SnapshotNotFoundError):
        load_snapshot("daily", comparison_id="target", index_base_dir=index_dir)


def test_load_snapshot_raises_when_no_snapshot_for_frequency(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    _write_snapshot(index_dir, "target", "weekly", [])

    with pytest.raises(SnapshotNotFoundError):
        load_snapshot("daily", comparison_id=None, index_base_dir=index_dir)


def test_load_snapshot_rejects_a_comparison_id_with_path_separators(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    outside_file = tmp_path / "secret.json"
    outside_file.write_text(
        json.dumps({"comparison_id": "whatever", "frequency": "daily", "series": []})
    )

    with pytest.raises(SnapshotNotFoundError):
        load_snapshot("daily", comparison_id="../secret", index_base_dir=index_dir)


def test_load_snapshot_rejects_a_comparison_id_that_is_not_32_hex_chars(tmp_path):
    index_dir = tmp_path / "index"
    index_dir.mkdir()

    with pytest.raises(SnapshotNotFoundError):
        load_snapshot("daily", comparison_id="not-a-real-id", index_base_dir=index_dir)


def test_filter_series_by_start_and_end():
    series = [{"period": "2026-08-01"}, {"period": "2026-08-15"}, {"period": "2026-08-30"}]

    result = filter_series(series, start="2026-08-10", end="2026-08-20")

    assert [p["period"] for p in result] == ["2026-08-15"]


def test_filter_series_with_no_bounds_returns_everything():
    series = [{"period": "2026-08-01"}, {"period": "2026-08-15"}]

    assert filter_series(series, start=None, end=None) == series


def test_filter_series_boundaries_are_inclusive():
    series = [{"period": "2026-08-10"}, {"period": "2026-08-15"}, {"period": "2026-08-20"}]

    result = filter_series(series, start="2026-08-10", end="2026-08-20")

    assert [p["period"] for p in result] == ["2026-08-10", "2026-08-15", "2026-08-20"]


def test_filter_fare_records_by_origin_and_destination():
    records = [
        {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-24T10:00:00+00:00"},
        {"origin": "DEL", "destination": "BLR", "collected_at": "2026-08-24T10:00:00+00:00"},
    ]

    result = filter_fare_records(records, origin="DEL", destination="BOM", start=None, end=None)

    assert len(result) == 1
    assert result[0]["destination"] == "BOM"


def test_filter_fare_records_by_date_range_is_inclusive():
    records = [
        {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-24T10:00:00+00:00"},
        {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-25T10:00:00+00:00"},
    ]

    result = filter_fare_records(
        records,
        origin=None,
        destination=None,
        start="2026-08-24T10:00:00+00:00",
        end="2026-08-24T10:00:00+00:00",
    )

    assert len(result) == 1
    assert result[0]["collected_at"] == "2026-08-24T10:00:00+00:00"


def test_filter_fare_records_accepts_a_naive_date_bound():
    records = [
        {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-24T10:00:00+00:00"},
        {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-25T10:00:00+00:00"},
    ]

    result = filter_fare_records(
        records, origin=None, destination=None, start="2026-08-24", end="2026-08-24"
    )

    assert len(result) == 1
    assert result[0]["collected_at"] == "2026-08-24T10:00:00+00:00"


def test_load_fare_records_reads_from_cleaned_dir(tmp_path):
    cleaned_dir = tmp_path / "cleaned"
    cleaned_dir.mkdir()
    record = {"origin": "DEL", "destination": "BOM", "collected_at": "2026-08-24T10:00:00+00:00"}
    (cleaned_dir / "run1.jsonl").write_text(json.dumps(record) + "\n")

    records = load_fare_records(cleaned_base_dir=cleaned_dir)

    assert records == [record]


def test_load_weights_metadata_returns_full_payload(tmp_path):
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
