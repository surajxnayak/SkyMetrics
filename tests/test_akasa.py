"""Tests for the Akasa Air scraper (per-flight search endpoint)."""
import json
from datetime import date
from unittest.mock import MagicMock

import pytest

import scraper.sources.akasa as akasa_module
from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper


class _FrozenDate(date):
    @classmethod
    def today(cls):
        return date(2026, 8, 23)


def _fake_response(payload: dict) -> MagicMock:
    response = MagicMock()
    response.read.return_value = json.dumps(payload).encode()
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


def _service_charges(discounted_fare, tax, udf, other_fees):
    charges = [{"amount": discounted_fare, "code": None, "type": "FarePrice"}]
    for code, amount in other_fees.items():
        charges.append({"amount": amount, "code": code, "type": "TravelFee"})
    charges.append({"amount": udf, "code": "UDF", "type": "TravelFee"})
    charges.append({"amount": tax, "code": None, "type": "Tax"})
    return charges


def _fare_option(class_of_service, discounted_fare, tax, udf, other_fees):
    charges = _service_charges(discounted_fare, tax, udf, other_fees)
    fare_amount = sum(c["amount"] for c in charges)
    return {
        "value": {
            "fares": [
                {
                    "classOfService": class_of_service,
                    "passengerFares": [
                        {
                            "fareAmount": fare_amount,
                            "discountedFare": discounted_fare,
                            "serviceCharges": charges,
                        }
                    ],
                }
            ]
        }
    }


def _search_response(fare_options):
    return {"data": {"faresAvailable": fare_options}}


TOKEN_RESPONSE = {"data": {"idleTimeoutInMinutes": 15, "token": "test-token-123"}}
OTHER_FEES = {"CUTE": 75.0, "RCS": 50.0, "WFE": 350.0, "ASF": 236.0, "DUDF": 89.0}


def _guard_allowing_everything():
    guard = ComplianceGuard()
    guard.can_fetch = lambda url: True
    guard.wait_for_slot = lambda domain: None
    return guard


def test_fetch_quotes_maps_fee_breakdown_and_multiple_fare_classes(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)

    two_fare_response = _search_response(
        [
            _fare_option("T0", 5985.0, 306.0, 152.0, OTHER_FEES),
            _fare_option("U1", 6200.0, 310.0, 152.0, OTHER_FEES),
        ]
    )
    token_calls = []
    search_calls = []

    def fake_urlopen(request, timeout=15):
        if "generateToken" in request.full_url:
            token_calls.append(request)
            return _fake_response(TOKEN_RESPONSE)
        search_calls.append(request)
        return _fake_response(two_fare_response)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    scraper = AkasaScraper(_guard_allowing_everything())
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="run-1")
    # Same scraper instance handling a second route, as scraper/run.py does per source.
    quotes += scraper.fetch_quotes("DEL", "BLR", run_id="run-1")

    # 5 advance windows x 2 fare classes per window x 2 routes = 20 quotes
    assert len(quotes) == 20
    # Token is fetched once and reused across every subsequent call, including the second route.
    assert len(token_calls) == 1
    assert len(search_calls) == 10

    t0_quote = next(
        q
        for q in quotes
        if q.fare_class == "T0" and q.advance_window == "T+1" and q.destination == "BOM"
    )
    assert t0_quote.base_fare == 5985.0
    assert t0_quote.taxes == 306.0
    assert t0_quote.udf == 152.0
    assert t0_quote.convenience_fee == sum(OTHER_FEES.values())
    assert t0_quote.total_fare == pytest.approx(
        t0_quote.base_fare + t0_quote.taxes + t0_quote.udf + t0_quote.convenience_fee
    )
    assert t0_quote.fee_breakdown == {
        "FarePrice": 5985.0,
        "CUTE": 75.0,
        "RCS": 50.0,
        "WFE": 350.0,
        "ASF": 236.0,
        "UDF": 152.0,
        "DUDF": 89.0,
        "Tax": 306.0,
    }
    assert t0_quote.status == "available"
    assert t0_quote.carrier == "QP"
    assert t0_quote.source == "akasaair"


def test_fetch_quotes_marks_no_flight_when_no_fares_available(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)

    def fake_urlopen(request, timeout=15):
        if "generateToken" in request.full_url:
            return _fake_response(TOKEN_RESPONSE)
        return _fake_response(_search_response([]))

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    scraper = AkasaScraper(_guard_allowing_everything())
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="run-1")

    assert len(quotes) == 5
    assert all(q.status == "no_flight" and q.total_fare is None for q in quotes)
    assert all(q.fare_class is None and q.fee_breakdown is None for q in quotes)


def test_fetch_quotes_raises_when_robots_disallows(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    guard = ComplianceGuard()
    guard.can_fetch = lambda url: False

    scraper = AkasaScraper(guard)
    with pytest.raises(PermissionError):
        scraper.fetch_quotes("DEL", "BOM", run_id="run-1")
