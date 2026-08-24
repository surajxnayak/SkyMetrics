from datetime import datetime, timezone

import pytest

from index.aggregate import period_of, representative_prices


def _record(origin, destination, total_fare, collected_at, status="available", is_outlier=False):
    return {
        "origin": origin,
        "destination": destination,
        "total_fare": total_fare,
        "collected_at": collected_at.isoformat(),
        "status": status,
        "is_outlier": is_outlier,
    }


def test_period_of_daily():
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    assert period_of(dt, "daily") == "2026-08-24"


def test_period_of_weekly():
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    iso_year, iso_week, _ = dt.isocalendar()
    assert period_of(dt, "weekly") == f"{iso_year}-W{iso_week:02d}"


def test_period_of_monthly():
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    assert period_of(dt, "monthly") == "2026-08"


def test_period_of_rejects_unknown_frequency():
    with pytest.raises(ValueError):
        period_of(datetime(2026, 8, 24, tzinfo=timezone.utc), "yearly")


def test_representative_prices_averages_across_windows_and_classes():
    collected_at = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, collected_at),
        _record("DEL", "BOM", 7000.0, collected_at),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6500.0


def test_representative_prices_excludes_outliers():
    collected_at = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, collected_at),
        _record("DEL", "BOM", 999999.0, collected_at, is_outlier=True),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6000.0


def test_representative_prices_excludes_no_flight_records():
    collected_at = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, collected_at),
        _record("DEL", "BOM", None, collected_at, status="no_flight"),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6000.0


def test_representative_prices_separates_different_routes_and_periods():
    day1 = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    day2 = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, day1),
        _record("DEL", "BLR", 7000.0, day1),
        _record("DEL", "BOM", 6600.0, day2),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6000.0
    assert prices[("DEL-BLR", "2026-08-24")] == 7000.0
    assert prices[("DEL-BOM", "2026-08-25")] == 6600.0
