"""Representative price per (route, period), excluding flagged outliers.

This is where Phase 2's deliberate "flag, don't delete" choice gets acted
on: is_outlier=True records are excluded from the average here, which is
the actual point of flagging rather than deleting them (Phase 2's own
design spec: "Phase 3's decision, not Phase 2's").

Averages across every advance-purchase window, fare class, and itinerary
type (nonstop and connecting alike) collected for a route within a period
-- consistent with keeping every itinerary type rather than filtering to
nonstop-only (see the fare-decomposition upgrade's design spec).
"""
from __future__ import annotations

from datetime import datetime

from index.weights import route_key

VALID_FREQUENCIES = {"daily", "weekly", "monthly"}


def period_of(collected_at: datetime, frequency: str) -> str:
    if frequency == "daily":
        return collected_at.date().isoformat()
    if frequency == "weekly":
        iso_year, iso_week, _ = collected_at.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if frequency == "monthly":
        return f"{collected_at.year:04d}-{collected_at.month:02d}"
    raise ValueError(f"unknown frequency: {frequency!r}")


def representative_prices(
    cleaned_records: list[dict], frequency: str
) -> dict[tuple[str, str], float]:
    buckets: dict[tuple[str, str], list[float]] = {}
    for record in cleaned_records:
        if record["status"] != "available" or record["is_outlier"]:
            continue
        route = route_key(record["origin"], record["destination"])
        collected_at = datetime.fromisoformat(record["collected_at"])
        period = period_of(collected_at, frequency)
        buckets.setdefault((route, period), []).append(record["total_fare"])

    return {key: sum(values) / len(values) for key, values in buckets.items()}
