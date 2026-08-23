import json
from datetime import date, timedelta
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pytest

import scraper.sources.akasa as akasa_module
from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper


class _FrozenDate(date):
    @classmethod
    def today(cls):
        return date(2026, 8, 23)


def _fake_urlopen_factory(sold_out=False):
    def fake_urlopen(request, timeout=15):
        query = parse_qs(urlparse(request.full_url).query)
        start = date.fromisoformat(query["startDate"][0][:10])
        entries = []
        for i in range(31):
            d = start + timedelta(days=i)
            entries.append(
                {
                    "date": f"{d.isoformat()}T00:00:00",
                    "isLowest": False,
                    "noFlights": False,
                    "price": 5000.0 + i,
                    "soldOut": sold_out,
                }
            )
        payload = json.dumps({"data": entries}).encode()
        response = MagicMock()
        response.read.return_value = payload
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    return fake_urlopen


def _guard_allowing_everything():
    guard = ComplianceGuard()
    guard.can_fetch = lambda url: True
    guard.wait_for_slot = lambda domain: None
    return guard


def test_fetch_quotes_returns_one_per_advance_window(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    monkeypatch.setattr("urllib.request.urlopen", _fake_urlopen_factory())

    scraper = AkasaScraper(_guard_allowing_everything())
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="run-1")

    assert len(quotes) == 5
    assert {q.advance_window for q in quotes} == {"T+1", "T+7", "T+15", "T+30", "T+45"}
    for q in quotes:
        assert q.origin == "DEL"
        assert q.destination == "BOM"
        assert q.carrier == "QP"
        assert q.source == "akasaair"
        assert q.status == "available"
        assert q.total_fare is not None


def test_fetch_quotes_marks_sold_out_dates(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    monkeypatch.setattr("urllib.request.urlopen", _fake_urlopen_factory(sold_out=True))

    scraper = AkasaScraper(_guard_allowing_everything())
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="run-1")

    assert all(q.status == "sold_out" and q.total_fare is None for q in quotes)


def test_fetch_quotes_raises_when_robots_disallows(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    guard = ComplianceGuard()
    guard.can_fetch = lambda url: False

    scraper = AkasaScraper(guard)
    with pytest.raises(PermissionError):
        scraper.fetch_quotes("DEL", "BOM", run_id="run-1")
