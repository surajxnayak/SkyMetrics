"""Read-only data access for the API layer (PRD F-5.1/F-5.2/F-5.3): loads
already-computed index snapshots, cleaned fare records, and route-weight
metadata straight from disk on every call. No caching -- see the design
spec for why (data volume is small enough that re-reading every request
is simpler and avoids invalidation bugs entirely).
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from index.build import INDEX_BASE_DIR, load_all_cleaned_records
from index.weights import WEIGHTS_PATH

_COMPARISON_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")

load_fare_records = load_all_cleaned_records


class SnapshotNotFoundError(Exception):
    pass


def list_snapshots(index_base_dir: Path = INDEX_BASE_DIR) -> list[dict]:
    snapshots = []
    for path in index_base_dir.glob("*.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        snapshots.append(
            {
                "comparison_id": payload["comparison_id"],
                "frequency": payload["frequency"],
                "written_at": datetime.fromtimestamp(
                    path.stat().st_mtime, tz=timezone.utc
                ).isoformat(),
            }
        )
    snapshots.sort(key=lambda s: s["written_at"], reverse=True)
    return snapshots


def load_snapshot(
    frequency: str, comparison_id: str | None, index_base_dir: Path = INDEX_BASE_DIR
) -> dict:
    if comparison_id is not None:
        if not _COMPARISON_ID_PATTERN.fullmatch(comparison_id):
            raise SnapshotNotFoundError(f"no snapshot with comparison_id {comparison_id!r}")
        path = index_base_dir / f"{comparison_id}.json"
        if not path.exists():
            raise SnapshotNotFoundError(f"no snapshot with comparison_id {comparison_id!r}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload["frequency"] != frequency:
            raise SnapshotNotFoundError(
                f"snapshot {comparison_id!r} has frequency {payload['frequency']!r}, "
                f"not {frequency!r}"
            )
        return payload

    matches = [s for s in list_snapshots(index_base_dir) if s["frequency"] == frequency]
    if not matches:
        raise SnapshotNotFoundError(f"no snapshot found for frequency {frequency!r}")
    newest = matches[0]
    path = index_base_dir / f"{newest['comparison_id']}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def filter_series(series: list[dict], start: str | None, end: str | None) -> list[dict]:
    result = series
    if start is not None:
        result = [point for point in result if point["period"] >= start]
    if end is not None:
        result = [point for point in result if point["period"] <= end]
    return result


def _parse_datetime(value: str, *, end_of_day: bool = False) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if end_of_day and len(value) == len("YYYY-MM-DD"):
        # ponytail: bare date given as an upper bound means "through this whole
        # day", not "through its first instant" -- widen to the last microsecond.
        parsed += timedelta(days=1) - timedelta(microseconds=1)
    return parsed


def filter_fare_records(
    records: list[dict],
    origin: str | None,
    destination: str | None,
    start: str | None,
    end: str | None,
) -> list[dict]:
    result = records
    if origin is not None:
        result = [r for r in result if r["origin"] == origin]
    if destination is not None:
        result = [r for r in result if r["destination"] == destination]
    if start is not None:
        start_dt = _parse_datetime(start)
        result = [r for r in result if datetime.fromisoformat(r["collected_at"]) >= start_dt]
    if end is not None:
        end_dt = _parse_datetime(end, end_of_day=True)
        result = [r for r in result if datetime.fromisoformat(r["collected_at"]) <= end_dt]
    return result


def load_weights_metadata(weights_path: Path = WEIGHTS_PATH) -> dict:
    return json.loads(weights_path.read_text(encoding="utf-8"))
