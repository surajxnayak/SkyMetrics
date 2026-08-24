from datetime import date, datetime, timezone

from pipeline.schema import CleanedFareQuote
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
        fee_breakdown={"FarePrice": 5985.0},
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_to_json_dict_includes_quote_fields_and_cleaning_metadata():
    quote = _quote()
    cleaned = CleanedFareQuote(quote=quote, is_outlier=False, source_quote_ids=[quote.quote_id])

    d = cleaned.to_json_dict()

    assert d["origin"] == "DEL"
    assert d["total_fare"] == 7243.0
    assert d["is_outlier"] is False
    assert d["source_quote_ids"] == [quote.quote_id]


def test_is_outlier_can_be_true():
    quote = _quote()
    cleaned = CleanedFareQuote(quote=quote, is_outlier=True, source_quote_ids=[quote.quote_id])
    assert cleaned.to_json_dict()["is_outlier"] is True


def test_source_quote_ids_can_list_multiple_ids():
    quote = _quote()
    cleaned = CleanedFareQuote(quote=quote, is_outlier=False, source_quote_ids=["a", "b"])
    assert cleaned.to_json_dict()["source_quote_ids"] == ["a", "b"]
