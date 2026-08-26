import json
from datetime import date, datetime, timezone

from scraper import run as run_module
from scraper.schema import FareQuote, new_quote_id


def test_load_basket_reads_config_file():
    basket = run_module.load_basket()
    assert {"origin": "DEL", "destination": "BOM"} in basket["city_pairs"]


class _StubScraper:
    source_name = "stubsource"
    carrier_code = "ZZ"

    def __init__(self, compliance):
        self.compliance = compliance

    def fetch_quotes(self, origin, destination, run_id):
        return [
            FareQuote(
                quote_id=new_quote_id(),
                origin=origin,
                destination=destination,
                carrier="ZZ",
                source="stubsource",
                travel_date=date(2026, 9, 1),
                collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
                advance_window="T+7",
                fare_class=None,
                base_fare=None,
                taxes=None,
                udf=None,
                convenience_fee=None,
                total_fare=1234.0,
                status="available",
                run_id=run_id,
            )
        ]


def test_run_writes_quotes_for_each_configured_source(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "SCRAPERS", {"stubsource": _StubScraper})
    monkeypatch.setattr(
        run_module, "load_basket", lambda: {"city_pairs": [{"origin": "DEL", "destination": "BOM"}]}
    )
    monkeypatch.chdir(tmp_path)

    run_module.run()

    out_files = list((tmp_path / "data" / "raw" / "stubsource").glob("*.jsonl"))
    assert len(out_files) == 1
    lines = out_files[0].read_text().strip().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["total_fare"] == 1234.0


class _PartialFailureScraper:
    source_name = "partialsource"
    carrier_code = "YY"

    def __init__(self, compliance):
        self.compliance = compliance

    def fetch_quotes(self, origin, destination, run_id):
        if destination == "BLR":
            raise PermissionError("robots.txt disallows this route")
        return [
            FareQuote(
                quote_id=new_quote_id(),
                origin=origin,
                destination=destination,
                carrier="YY",
                source="partialsource",
                travel_date=date(2026, 9, 1),
                collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
                advance_window="T+7",
                fare_class=None,
                base_fare=None,
                taxes=None,
                udf=None,
                convenience_fee=None,
                total_fare=4321.0,
                status="available",
                run_id=run_id,
            )
        ]


def test_run_skips_failing_routes_and_keeps_successful_ones(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "SCRAPERS", {"partialsource": _PartialFailureScraper})
    monkeypatch.setattr(
        run_module,
        "load_basket",
        lambda: {
            "city_pairs": [
                {"origin": "DEL", "destination": "BOM"},
                {"origin": "DEL", "destination": "BLR"},
            ]
        },
    )
    monkeypatch.chdir(tmp_path)

    run_module.run()

    out_files = list((tmp_path / "data" / "raw" / "partialsource").glob("*.jsonl"))
    assert len(out_files) == 1
    lines = out_files[0].read_text().strip().splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["destination"] == "BOM"
    assert record["total_fare"] == 4321.0


def test_run_returns_the_run_id_used_for_quotes(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "SCRAPERS", {"stubsource": _StubScraper})
    monkeypatch.setattr(
        run_module, "load_basket", lambda: {"city_pairs": [{"origin": "DEL", "destination": "BOM"}]}
    )
    monkeypatch.chdir(tmp_path)

    run_id = run_module.run()

    out_files = list((tmp_path / "data" / "raw" / "stubsource").glob("*.jsonl"))
    assert len(out_files) == 1
    assert out_files[0].stem == run_id
