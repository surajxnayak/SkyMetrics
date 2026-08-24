# Akasa Fare-Decomposition Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Akasa scraper's calendar-endpoint collection (blended total fare only) with the real per-flight search endpoint, capturing exact fare-class-level decomposition (base fare, tax, UDF, other fees) verified against live data.

**Architecture:** `AkasaScraper` gains a token-fetch step (cached per instance) feeding a per-date `availability/search` POST call. Every fare-class option in a response becomes its own `FareQuote`, with fees mapped from the response's `serviceCharges` array into `base_fare`/`taxes`/`udf`/`convenience_fee` plus a new full-fidelity `fee_breakdown` field. The old calendar-endpoint code is removed entirely — no dual-path fallback.

**Tech Stack:** Same as Phase 1 — stdlib only (`urllib.request`, `json`, `datetime`), `pytest` + `unittest.mock` for tests, `ruff` for lint.

**Reference:** `docs/superpowers/specs/2026-08-24-akasa-fare-decomposition-upgrade-design.md` for the full endpoint verification and fee-mapping rationale this plan implements.

---

### Task 1: Add `fee_breakdown` field to `FareQuote`

**Files:**
- Modify: `scraper/schema.py`
- Modify: `tests/test_schema.py`

- [ ] **Step 1: Write the failing tests**

Add these three tests to the end of `tests/test_schema.py` (the file already has `make_quote`, `FareQuote`, `pytest` imported — no new imports needed):

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_schema.py -v`
Expected: FAIL — `TypeError: FareQuote.__init__() got an unexpected keyword argument 'fee_breakdown'`

- [ ] **Step 3: Add the field to `scraper/schema.py`**

In `scraper/schema.py`, add `fee_breakdown` as the **last** field of the `FareQuote` dataclass, with a default of `None` (existing call sites across the codebase construct `FareQuote(...)` without this field — a default is required so nothing else breaks):

```python
@dataclass(frozen=True)
class FareQuote:
    quote_id: str
    origin: str
    destination: str
    carrier: str
    source: str
    travel_date: date
    collected_at: datetime
    advance_window: str
    fare_class: Optional[str]
    base_fare: Optional[float]
    taxes: Optional[float]
    udf: Optional[float]
    convenience_fee: Optional[float]
    total_fare: Optional[float]
    status: str
    run_id: str
    fee_breakdown: Optional[dict[str, float]] = None
```

(Every field above `fee_breakdown` is unchanged from the current file — only the new last line is added.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_schema.py -v`
Expected: PASS (10 tests: the 7 already there plus these 3)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS (29 tests: 26 existing + 3 new; `fee_breakdown`'s default means `test_akasa.py`, `test_storage.py`, `test_run.py` all still construct `FareQuote` exactly as before with no changes needed yet)

- [ ] **Step 6: Commit**

```bash
git add scraper/schema.py tests/test_schema.py
git commit -m "feat: add fee_breakdown field to FareQuote for itemized fare detail"
```

---

### Task 2: Rewrite `AkasaScraper` for real fare decomposition

**Files:**
- Modify: `scraper/sources/akasa.py` (full rewrite — replace the entire file's contents)
- Modify: `tests/test_akasa.py` (full rewrite — replace the entire file's contents)

This replaces the calendar-endpoint approach (2 calls per route, blended price, `fare_class`/`base_fare`/`taxes`/`udf`/`convenience_fee` always null) with the per-flight search endpoint (token + 5 calls per route, exact decomposition, multiple fare-class records per date).

- [ ] **Step 1: Write the failing tests — replace the entire contents of `tests/test_akasa.py`**

```python
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
        q for q in quotes if q.fare_class == "T0" and q.advance_window == "T+1" and q.destination == "BOM"
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_akasa.py -v`
Expected: FAIL — the old `test_fetch_quotes_returns_one_per_advance_window` etc. no longer exist (this file was fully replaced), and the new tests fail because `AkasaScraper` doesn't yet call a `generateToken`/`availability/search` flow. You should see errors like `AssertionError: assert 0 == 20` or similar, since the current implementation still hits the old calendar endpoint shape.

- [ ] **Step 3: Replace the entire contents of `scraper/sources/akasa.py`**

```python
"""Akasa Air scraper (PRD source list, §3.3).

Endpoints verified 2026-08-24 by tracing the live booking widget's network
calls, and confirmed reproducible via plain curl with no browser:
  1. POST .../token/generateToken -- a plain, unauthenticated token issuer.
  2. POST .../availability/search -- the real per-flight fare search, using
     that token as the Authorization header. Returns exact fare-class-level
     decomposition (base fare, tax, UDF, and other fees as separate line
     items) rather than a blended total.

Fee mapping (verified by hand against a live response -- see design spec
2026-08-24-akasa-fare-decomposition-upgrade-design.md):
  base_fare = the "FarePrice"-type serviceCharges entry
  taxes = the "Tax"-type serviceCharges entry
  udf = the entry coded "UDF"
  convenience_fee = sum of every remaining fee (CUTE, RCS, WFE, ASF, DUDF, ...)
  total_fare (the source's own fareAmount) == base_fare + taxes + udf + convenience_fee

A date with no fare options is recorded as status="no_flight" -- this
endpoint has no verified sold-out-vs-no-flight distinction (unlike the
earlier calendar endpoint), so this is a documented simplification, not an
oversight: split it out later if a real sold-out signal is found.
"""
from __future__ import annotations

import json
import urllib.request
from datetime import date, datetime, timedelta, timezone

from scraper.base import BaseScraper
from scraper.compliance import ComplianceGuard
from scraper.schema import ADVANCE_WINDOWS, FareQuote, new_quote_id

TOKEN_URL = "https://prod-bl.qp.akasaair.com/api/ibe/token/generateToken"
SEARCH_URL = "https://prod-bl.qp.akasaair.com/api/ibe/availability/search"
SEARCH_DOMAIN = "prod-bl.qp.akasaair.com"


class AkasaScraper(BaseScraper):
    source_name = "akasaair"
    carrier_code = "QP"

    def __init__(self, compliance: ComplianceGuard):
        self.compliance = compliance
        self._token: str | None = None

    def fetch_quotes(self, origin: str, destination: str, run_id: str) -> list[FareQuote]:
        today = date.today()
        quotes = []
        for window, days_ahead in ADVANCE_WINDOWS.items():
            travel_date = today + timedelta(days=days_ahead)
            fares_available = self._search(origin, destination, travel_date)
            collected_at = datetime.now(timezone.utc)
            if not fares_available:
                quotes.append(
                    self._no_flight_quote(origin, destination, travel_date, window, collected_at, run_id)
                )
                continue
            for class_of_service, passenger_fare in self._iter_fare_options(fares_available):
                quotes.append(
                    self._to_quote(
                        origin,
                        destination,
                        travel_date,
                        window,
                        class_of_service,
                        passenger_fare,
                        collected_at,
                        run_id,
                    )
                )
        return quotes

    def _get_token(self) -> str:
        if self._token is not None:
            return self._token

        if not self.compliance.can_fetch(TOKEN_URL):
            raise PermissionError(f"robots.txt disallows fetching {TOKEN_URL}")

        self.compliance.wait_for_slot(SEARCH_DOMAIN)
        body = json.dumps({"deviceType": "WEB", "bookingType": "BOOKING", "userType": "GUEST"}).encode()
        request = urllib.request.Request(
            TOKEN_URL,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": self.compliance.user_agent,
            },
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read())

        self._token = payload["data"]["token"]
        return self._token

    def _search(self, origin: str, destination: str, travel_date: date) -> list[dict]:
        if not self.compliance.can_fetch(SEARCH_URL):
            raise PermissionError(f"robots.txt disallows fetching {SEARCH_URL}")

        token = self._get_token()
        body = json.dumps(
            {
                "criteria": [
                    {
                        "stations": {
                            "originStationCodes": [origin],
                            "destinationStationCodes": [destination],
                            "searchDestinationMacs": True,
                            "searchOriginMacs": True,
                        },
                        "dates": {"beginDate": travel_date.strftime("%Y-%m-%dT00:00:00")},
                        "filters": {
                            "compressionType": 1,
                            "maxConnections": 8,
                            "productClasses": ["NB", "LB", "EC", "AV"],
                            "fareTypes": ["NB", "LB", "R", "V"],
                        },
                    }
                ],
                "passengers": {"types": [{"type": "ADT", "count": 1}], "residentCountry": ""},
                "codes": {"currencyCode": "INR", "promotionCode": ""},
                "offerCode": None,
                "numberOfFaresPerJourney": 10,
                "taxesAndFees": 1,
            }
        ).encode()

        self.compliance.wait_for_slot(SEARCH_DOMAIN)
        request = urllib.request.Request(
            SEARCH_URL,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": token,
                "User-Agent": self.compliance.user_agent,
            },
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read())

        return payload["data"]["faresAvailable"]

    @staticmethod
    def _iter_fare_options(fares_available: list[dict]):
        for entry in fares_available:
            for fare in entry.get("value", {}).get("fares", []):
                class_of_service = fare.get("classOfService")
                for passenger_fare in fare.get("passengerFares", []):
                    yield class_of_service, passenger_fare

    @staticmethod
    def _compute_fees(service_charges: list[dict]):
        fee_breakdown: dict[str, float] = {}
        base_fare = 0.0
        taxes = 0.0
        udf = 0.0
        convenience_fee = 0.0
        for charge in service_charges:
            code = charge.get("code")
            charge_type = charge.get("type")
            amount = charge.get("amount", 0.0)
            key = code if code else charge_type
            fee_breakdown[key] = amount
            if charge_type == "FarePrice":
                base_fare += amount
            elif charge_type == "Tax":
                taxes += amount
            elif code == "UDF":
                udf += amount
            else:
                convenience_fee += amount
        return fee_breakdown, base_fare, taxes, udf, convenience_fee

    def _to_quote(
        self, origin, destination, travel_date, window, class_of_service, passenger_fare, collected_at, run_id
    ):
        fee_breakdown, base_fare, taxes, udf, convenience_fee = self._compute_fees(
            passenger_fare.get("serviceCharges", [])
        )
        return FareQuote(
            quote_id=new_quote_id(),
            origin=origin,
            destination=destination,
            carrier=self.carrier_code,
            source=self.source_name,
            travel_date=travel_date,
            collected_at=collected_at,
            advance_window=window,
            fare_class=class_of_service,
            base_fare=base_fare,
            taxes=taxes,
            udf=udf,
            convenience_fee=convenience_fee,
            total_fare=passenger_fare.get("fareAmount"),
            status="available",
            run_id=run_id,
            fee_breakdown=fee_breakdown,
        )

    def _no_flight_quote(self, origin, destination, travel_date, window, collected_at, run_id):
        return FareQuote(
            quote_id=new_quote_id(),
            origin=origin,
            destination=destination,
            carrier=self.carrier_code,
            source=self.source_name,
            travel_date=travel_date,
            collected_at=collected_at,
            advance_window=window,
            fare_class=None,
            base_fare=None,
            taxes=None,
            udf=None,
            convenience_fee=None,
            total_fare=None,
            status="no_flight",
            run_id=run_id,
            fee_breakdown=None,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_akasa.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (29 tests — same total as after Task 1, since this task replaces 3 old akasa tests with 3 new ones)

Run: `ruff check .`
Expected: no errors (fix any import-order or line-length issues before proceeding)

- [ ] **Step 6: Commit**

```bash
git add scraper/sources/akasa.py tests/test_akasa.py
git commit -m "feat: rewrite Akasa scraper for exact fare decomposition via per-flight endpoint"
```

---

### Task 3: Update live verification and confirm against the real endpoint

**Files:**
- Modify: `scripts/verify_live.py`

The script's call to `fetch_quotes` doesn't change (same signature), but the output needs to show the new decomposition fields — otherwise this manual check wouldn't actually prove the upgrade works against live data.

- [ ] **Step 1: Replace the print loop in `scripts/verify_live.py`**

The file currently ends with:

```python
if __name__ == "__main__":
    guard = ComplianceGuard()
    scraper = AkasaScraper(guard)
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="verify-live")
    for q in quotes:
        print(q.advance_window, q.travel_date, q.status, q.total_fare)
```

Replace the `for` loop with:

```python
if __name__ == "__main__":
    guard = ComplianceGuard()
    scraper = AkasaScraper(guard)
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="verify-live")
    for q in quotes:
        print(
            q.advance_window,
            q.travel_date,
            q.status,
            q.fare_class,
            "total=", q.total_fare,
            "base=", q.base_fare,
            "tax=", q.taxes,
            "udf=", q.udf,
            "conv=", q.convenience_fee,
        )
```

(Everything above the `if __name__ == "__main__":` line — the docstring, `sys.path` shim, imports — is unchanged from the current file.)

- [ ] **Step 2: Run it against the real live endpoint**

Run: `python scripts/verify_live.py`

Expected: multiple lines of output (5 windows × however many fare classes Akasa actually returns per date — could be more than one per window, unlike the old single-line-per-window output), each showing a real advance window, travel date, `available` status, a real fare-class code (e.g. `T0`, `U1`), and five numeric money fields where `total=` equals the sum of `base=`, `tax=`, `udf=`, and `conv=` (allow for float rounding).

- [ ] **Step 3: Verify the total-equals-sum invariant on the real output**

For at least 2 of the printed lines, manually check: `total_fare ≈ base_fare + taxes + udf + convenience_fee`. This confirms the fee-mapping logic holds against live data, not just the mocked tests.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_live.py
git commit -m "chore: show fare decomposition in the live verification script"
```

---

## Definition of done

- `pytest -v` passes with 29 tests, zero live network calls in the suite.
- `ruff check .` passes clean.
- `python -m scraper.run` still works end-to-end (uses the same `fetch_quotes` interface — no changes needed to `run.py`, `storage.py`, or the CI workflows) and produces JSONL records where `akasaair` entries now have real `fare_class`/`base_fare`/`taxes`/`udf`/`convenience_fee`/`fee_breakdown` values instead of nulls.
- `python scripts/verify_live.py` prints real, decomposed fares from the live endpoint, with the total-equals-sum invariant holding.
