"""Akasa Air scraper (PRD source list, §3.3).

Endpoint verified 2026-08-23 by tracing the live booking widget's network
calls: a plain, unauthenticated JSON GET on prod-bl.qp.akasaair.com (a
domain with no robots.txt of its own -- default allow). Returns a
31-day fare calendar per call; two calls cover all five advance-purchase
windows (T+1 through T+45). The calendar gives a blended lowest-fare-per-day
figure, not a fare-class/component breakdown, so fare_class/base_fare/taxes/
udf/convenience_fee are left null here -- decomposing total_fare into
components is Phase 2's job (PRD F-2.1), not Phase 1's.
"""
from __future__ import annotations

import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode

from scraper.base import BaseScraper
from scraper.compliance import ComplianceGuard
from scraper.schema import ADVANCE_WINDOWS, FareQuote, new_quote_id

CALENDAR_URL = "https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search"
CALENDAR_DOMAIN = "prod-bl.qp.akasaair.com"
CALL_OFFSETS_DAYS = (0, 16)  # two 31-day windows starting today and today+16 cover T+1..T+45


class AkasaScraper(BaseScraper):
    source_name = "akasaair"
    carrier_code = "QP"

    def __init__(self, compliance: ComplianceGuard):
        self.compliance = compliance

    def fetch_quotes(self, origin: str, destination: str, run_id: str) -> list[FareQuote]:
        today = date.today()
        by_date: dict[str, dict] = {}
        for offset in CALL_OFFSETS_DAYS:
            start = today + timedelta(days=offset)
            by_date.update(self._fetch_calendar(origin, destination, start))

        collected_at = datetime.now(timezone.utc)
        quotes = []
        for window, days_ahead in ADVANCE_WINDOWS.items():
            travel_date = today + timedelta(days=days_ahead)
            entry = by_date.get(travel_date.isoformat())
            quotes.append(
                self._to_quote(
                    origin, destination, travel_date, window, entry, collected_at, run_id
                )
            )
        return quotes

    def _fetch_calendar(self, origin: str, destination: str, start: date) -> dict[str, dict]:
        params = {
            "origin": origin,
            "destination": destination,
            "startDate": start.strftime("%Y-%m-%dT00:00:00+05:30"),
            "numberOfPassengers": 1,
            "channel": "WEB",
            "currencyCode": "INR",
        }
        url = f"{CALENDAR_URL}?{urlencode(params)}"

        if not self.compliance.can_fetch(url):
            raise PermissionError(f"robots.txt disallows fetching {url}")

        # ponytail: a malformed/unexpected response (bad JSON, missing keys,
        # non-200 status) raises uncaught here and aborts the whole run --
        # acceptable while Akasa is the only live source; add per-source
        # error isolation if a second live source lands.
        self.compliance.wait_for_slot(CALENDAR_DOMAIN)
        request = urllib.request.Request(
            url, headers={"Accept": "application/json", "User-Agent": self.compliance.user_agent}
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            body = json.loads(response.read())

        return {entry["date"][:10]: entry for entry in body["data"]}

    def _to_quote(self, origin, destination, travel_date, window, entry, collected_at, run_id):
        if entry is None or entry.get("noFlights"):
            status, total_fare = "no_flight", None
        elif entry.get("soldOut"):
            status, total_fare = "sold_out", None
        else:
            status, total_fare = "available", entry["price"]

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
            total_fare=total_fare,
            status=status,
            run_id=run_id,
        )
