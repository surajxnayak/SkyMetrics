from datetime import date, datetime, timezone

import pytest

from scraper.schema import FareQuote, new_quote_id


def make_quote(**overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=6530.0,
        status="available",
        run_id="run-1",
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_valid_quote_constructs():
    quote = make_quote()
    assert quote.total_fare == 6530.0


def test_rejects_invalid_advance_window():
    with pytest.raises(ValueError):
        make_quote(advance_window="T+99")


def test_rejects_invalid_status():
    with pytest.raises(ValueError):
        make_quote(status="maybe")


def test_to_json_dict_serialises_dates():
    quote = make_quote()
    d = quote.to_json_dict()
    assert d["travel_date"] == "2026-09-01"
    assert d["collected_at"] == "2026-08-23T12:00:00+00:00"


def test_fee_breakdown_defaults_to_none():
    quote = make_quote()
    assert quote.fee_breakdown is None


def test_fee_breakdown_can_be_set():
    quote = make_quote(fee_breakdown={"CUTE": 75.0, "UDF": 152.0})
    assert quote.fee_breakdown == {"CUTE": 75.0, "UDF": 152.0}


def test_to_json_dict_includes_fee_breakdown():
    quote = make_quote(fee_breakdown={"UDF": 152.0})
    d = quote.to_json_dict()
    assert d["fee_breakdown"] == {"UDF": 152.0}


def test_routing_defaults_to_none():
    quote = make_quote()
    assert quote.routing is None


def test_routing_can_be_set():
    quote = make_quote(routing="DXN-BLR|BLR-BOM")
    assert quote.routing == "DXN-BLR|BLR-BOM"
