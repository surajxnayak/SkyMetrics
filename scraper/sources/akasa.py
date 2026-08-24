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
                    self._no_flight_quote(
                        origin, destination, travel_date, window, collected_at, run_id
                    )
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
        body = json.dumps(
            {"deviceType": "WEB", "bookingType": "BOOKING", "userType": "GUEST"}
        ).encode()
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
        self,
        origin,
        destination,
        travel_date,
        window,
        class_of_service,
        passenger_fare,
        collected_at,
        run_id,
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
