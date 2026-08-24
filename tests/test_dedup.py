from datetime import date, datetime, timezone

from pipeline.dedup import dedup_quotes
from scraper.schema import FareQuote, new_quote_id


def _quote(**overrides):
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
        base_fare=5985.0,
        taxes=306.0,
        udf=152.0,
        convenience_fee=800.0,
        total_fare=7243.0,
        status="available",
        run_id="run-1",
        fee_breakdown=None,
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_distinct_quotes_are_not_collapsed():
    a = _quote(fare_class="T0", total_fare=7243.0)
    b = _quote(fare_class="U1", total_fare=6968.0)

    result = dedup_quotes([a, b])

    assert len(result) == 2


def test_identical_quotes_from_different_sources_collapse_with_provenance():
    a = _quote(source="akasaair")
    b = _quote(source="akasaair_via_partner")

    result = dedup_quotes([a, b])

    assert len(result) == 1
    representative, source_quote_ids = result[0]
    assert representative.quote_id == a.quote_id
    assert source_quote_ids == [a.quote_id, b.quote_id]


def test_different_carriers_with_the_same_price_are_not_collapsed():
    a = _quote(carrier="QP", total_fare=7243.0)
    b = _quote(carrier="6E", total_fare=7243.0)

    result = dedup_quotes([a, b])

    assert len(result) == 2


def test_no_flight_quotes_for_the_same_slot_collapse_too():
    no_flight_kwargs = dict(
        status="no_flight",
        fare_class=None,
        total_fare=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
    )
    a = _quote(**no_flight_kwargs)
    b = _quote(**no_flight_kwargs)

    result = dedup_quotes([a, b])

    assert len(result) == 1
