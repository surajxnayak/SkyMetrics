import json
from datetime import date, datetime, timezone

from scraper.schema import FareQuote, new_quote_id
from scraper.storage import write_quotes


def _quote(travel_date, total_fare, status="available"):
    return FareQuote(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=travel_date,
        collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=total_fare,
        status=status,
        run_id="run-1",
    )


def test_write_quotes_creates_one_line_per_quote(tmp_path):
    quotes = [_quote(date(2026, 8, 30), 6530.0), _quote(date(2026, 9, 6), 6893.0)]

    out_path = write_quotes(quotes, source="akasaair", run_id="run-1", base_dir=tmp_path)

    assert out_path == tmp_path / "akasaair" / "run-1.jsonl"
    lines = out_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["origin"] == "DEL"
    assert first["travel_date"] == "2026-08-30"
    assert first["total_fare"] == 6530.0


def test_write_quotes_creates_parent_directories(tmp_path):
    quotes = [_quote(date(2026, 8, 30), 6530.0)]
    out_path = write_quotes(quotes, source="akasaair", run_id="run-2", base_dir=tmp_path / "nested")
    assert out_path.exists()
