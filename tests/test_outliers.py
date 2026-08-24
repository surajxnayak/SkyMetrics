from datetime import date, datetime, timezone

from pipeline.outliers import flag_outliers
from scraper.schema import FareQuote, new_quote_id


def _quote(total_fare, **overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class="T0",
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=total_fare,
        status="available",
        run_id="run-1",
        fee_breakdown=None,
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_flags_a_clear_outlier_within_a_group():
    quotes = [
        _quote(6500.0),
        _quote(6600.0),
        _quote(6700.0),
        _quote(6800.0),
        _quote(6900.0),
        _quote(50000.0),
    ]

    flags = flag_outliers(quotes)

    assert flags[quotes[-1].quote_id] is True
    assert all(flags[q.quote_id] is False for q in quotes[:-1])


def test_does_not_flag_a_tight_cluster():
    quotes = [_quote(6500.0), _quote(6550.0), _quote(6600.0), _quote(6650.0), _quote(6700.0)]

    flags = flag_outliers(quotes)

    assert all(flags[q.quote_id] is False for q in quotes)


def test_groups_are_independent_by_route_and_window():
    route_with_an_outlier = [
        _quote(6500.0, destination="BLR"),
        _quote(6600.0, destination="BLR"),
        _quote(6700.0, destination="BLR"),
        _quote(6800.0, destination="BLR"),
        _quote(6900.0, destination="BLR"),
        _quote(50000.0, destination="BLR"),
    ]
    unrelated_wide_spread_route = [
        _quote(100.0, destination="HYD"),
        _quote(200.0, destination="HYD"),
        _quote(100000.0, destination="HYD"),
        _quote(200000.0, destination="HYD"),
        _quote(300000.0, destination="HYD"),
        _quote(400000.0, destination="HYD"),
    ]

    flags = flag_outliers(route_with_an_outlier + unrelated_wide_spread_route)

    # The 50000.0 fare is a real outlier within its own BLR group (verified
    # in isolation: Q1=6575, Q3=17675, bounds=(-10075, 34325)). If grouping
    # were broken and all 12 quotes merged into one bucket, the HYD route's
    # huge spread would inflate the combined IQR enough to swallow 50000.0
    # and this assertion would fail -- confirmed empirically before writing
    # this test.
    assert flags[route_with_an_outlier[-1].quote_id] is True
    assert all(flags[q.quote_id] is False for q in unrelated_wide_spread_route)


def test_small_groups_are_not_flagged():
    quotes = [_quote(1000.0), _quote(50000.0)]

    flags = flag_outliers(quotes)

    assert all(flags[q.quote_id] is False for q in quotes)


def test_five_point_groups_can_never_flag_even_a_clear_outlier():
    quotes = [_quote(900.0), _quote(920.0), _quote(940.0), _quote(960.0), _quote(50000.0)]

    flags = flag_outliers(quotes)

    # Documents a real, verified mathematical property of this method (see
    # module docstring) -- not the desired behavior, just the honest one.
    assert all(flags[q.quote_id] is False for q in quotes)


def test_no_flight_quotes_are_never_flagged():
    quote = _quote(None, status="no_flight", fare_class=None)

    flags = flag_outliers([quote])

    assert flags[quote.quote_id] is False
