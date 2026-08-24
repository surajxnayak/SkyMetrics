# SkyMetrics — Akasa Scraper Upgrade: Real Fare Decomposition

Date: 2026-08-24
Status: Approved for implementation

## Context

Phase 1 (shipped, `docs/superpowers/specs/2026-08-23-repo-scaffold-and-phase1-scraper-design.md`) collects Akasa Air fares via a calendar endpoint (`GET .../availability/v2/search`) that returns only a single blended lowest-price-per-day figure. Every raw record's `fare_class`, `base_fare`, `taxes`, `udf`, and `convenience_fee` fields are `null` — the PRD's fare-decomposition requirement (§4.2, F-2.1: "Split total fare into base fare, taxes, user development fee, and convenience charges") had no real data to work from, and would have had to be approximated in Phase 2 from a blended total.

While scoping Phase 2, we traced Akasa's real per-flight search flow (the same live-verification technique used throughout Phase 1) and found a second endpoint that returns genuinely decomposed fares per fare class, confirmed reproducible via plain `curl` with no browser:

```
POST https://prod-bl.qp.akasaair.com/api/ibe/token/generateToken
Body: {"deviceType":"WEB","bookingType":"BOOKING","userType":"GUEST"}
-> {"data":{"idleTimeoutInMinutes":15,"token":"<token>"}}

POST https://prod-bl.qp.akasaair.com/api/ibe/availability/search
Headers: Authorization: <token>
Body: {"criteria":[{"stations":{"originStationCodes":["DEL"],"destinationStationCodes":["BOM"],
       "searchDestinationMacs":true,"searchOriginMacs":true},
       "dates":{"beginDate":"<ISO8601 date>"},
       "filters":{"compressionType":1,"maxConnections":8,
       "productClasses":["NB","LB","EC","AV"],"fareTypes":["NB","LB","R","V"]}}],
       "passengers":{"types":[{"type":"ADT","count":1}],"residentCountry":""},
       "codes":{"currencyCode":"INR","promotionCode":""},
       "offerCode":null,"numberOfFaresPerJourney":10,"taxesAndFees":1}
```

Response (abbreviated, one fare option shown):

```json
{"data":{"faresAvailable":[{"value":{"fares":[{
  "classOfService":"T0",
  "passengerFares":[{
    "fareAmount":7243.0000,
    "discountedFare":5985.0000,
    "serviceCharges":[
      {"amount":5985.0,"code":null,"type":"FarePrice"},
      {"amount":75.0,"code":"CUTE","type":"TravelFee"},
      {"amount":50.0,"code":"RCS","type":"TravelFee"},
      {"amount":350.0,"code":"WFE","type":"TravelFee"},
      {"amount":236.0,"code":"ASF","type":"TravelFee"},
      {"amount":152.0,"code":"UDF","type":"TravelFee"},
      {"amount":89.0,"code":"DUDF","type":"TravelFee"},
      {"amount":306.0,"code":null,"type":"Tax"}
    ]
  }]
}}]}}
```

Verified by hand: `fareAmount` (7243.0) exactly equals the sum of every `serviceCharges` entry (5985+75+50+350+236+152+89+306=7243). This is an exact decomposition, not an estimate — worth building on before Phase 2, rather than having Phase 2 approximate components Phase 1 could have captured exactly.

## Goals

- Replace the calendar endpoint with the real per-flight search endpoint in `AkasaScraper`, capturing exact fare-class-level decomposition instead of a blended total.
- Capture every fare-class option returned per target date as its own raw record (no discarding at collection time — matches Phase 1's "raw collection, full provenance" principle).
- Preserve the itemized fee breakdown (not just the 4 PRD-schema buckets) so no source detail is lost.
- Keep the compliance guard as the sole gate on every request, exactly as before — this upgrade changes what's fetched, not whether fetching is checked.

## Non-goals

- No change to Phase 2/3/4/5 scope — this is a Phase 1 revision, done before Phase 2 starts, not Phase 2 itself.
- No change to `scraper/compliance.py`, `scraper/storage.py`, `scraper/run.py`, `scraper/base.py`, CI workflows, or the source registry — all untouched.
- No attempt to capture round-trip, multi-passenger, or international fares — same DEL/BOM/BLR one-way, one-adult scope as Phase 1.

## Fee decomposition mapping

For each `serviceCharges` entry in a fare option:

| Entry | Maps to |
|---|---|
| `type == "FarePrice"` (code `null`) | `base_fare` |
| `type == "Tax"` (code `null`) | `taxes` |
| `code == "UDF"` | `udf` |
| everything else (`CUTE`, `RCS`, `WFE`, `ASF`, `DUDF`, and any other `TravelFee`-type code) | summed into `convenience_fee` |

`convenience_fee` is documented in code as "other airline/regulatory fees" rather than literally an OTA charge, since Akasa is the airline itself, not an OTA — the PRD's field description ("OTA/portal charge") doesn't quite fit a direct-airline source, but reusing the existing field is simpler than adding a new one for one source.

Invariant (tested): `total_fare == base_fare + taxes + udf + convenience_fee`, since `total_fare` is the source's own `fareAmount`, which is itself the sum of every `serviceCharges` entry.

## Schema change

`FareQuote` (`scraper/schema.py`) gains one additive field:

```python
fee_breakdown: Optional[dict[str, float]]
```

Keyed by each `serviceCharges` entry's `code` (or `type`, for the two null-code entries: `FarePrice` and `Tax`), valued by its `amount`. E.g. `{"FarePrice": 5985.0, "CUTE": 75.0, "RCS": 50.0, "WFE": 350.0, "ASF": 236.0, "UDF": 152.0, "DUDF": 89.0, "Tax": 306.0}`. This is the full-fidelity record; the 4 top-level fields are a PRD-schema-compatible summary of the same data. `Optional`, defaults to `None` — existing consumers (`storage.py`, `run.py`) need no changes since they operate on `FareQuote` generically via `to_json_dict()`.

`fare_class` = the fare option's `classOfService` (e.g. `"T0"`) — this is what the PRD schema calls "booking class."

## Request flow per scraper run

1. Generate one token (`generateToken`), reused for every subsequent call in the run — its 15-minute idle timeout comfortably covers a handful of rate-limited sequential requests to one domain. The token call itself goes through `ComplianceGuard.can_fetch`/`wait_for_slot` exactly like every other request to this domain — no request of any kind bypasses the gate, including this one.
2. For each of the 3 configured city-pairs, for each of the 5 advance-purchase-window target dates, issue one `availability/search` POST (15 calls total, plus 1 token call = 16 requests per run, up from 6 in the calendar-based version). Every call still goes through `ComplianceGuard.can_fetch`/`wait_for_slot` exactly as before — more calls, same gate, same rate limit.
3. Each response's fare options become one `FareQuote` each (multiple rows possible per route/date).
4. A date with an empty `faresAvailable` array still needs an explicit record per the existing PRD requirement (F-1.6, graceful degradation) rather than silently producing zero rows for that date. Unlike the calendar endpoint, this endpoint's response carries no verified `soldOut`-vs-no-flight distinction — we have not observed a real sold-out response from it. Empty `faresAvailable` therefore maps uniformly to `status="no_flight"` for now, documented as a known simplification: if a genuine sold-out signal from this endpoint is found later, split it out then rather than guessing at an unverified field now.

## What changes in code

- `scraper/schema.py`: add `fee_breakdown` field to `FareQuote`.
- `scraper/sources/akasa.py`: rewritten — token generation, per-date search calls, fare-option-to-FareQuote mapping, fee-bucket computation. Old calendar-endpoint code removed entirely.
- `tests/test_akasa.py`: rewritten against the new response shape (mocked, no live network, same as before) — covering: multiple fare classes per date produce multiple records, fee mapping matches the table above, the `total_fare == sum of 4 buckets` invariant, the empty-`faresAvailable` (no-flight) case, and the existing robots.txt-disallow-blocks-the-call test.
- Nothing else changes.

## Testing

Same approach as Phase 1: `unittest.mock` patches `urllib.request.urlopen` with canned JSON (now two response shapes — token response and search response), no live network in the automated suite. `scripts/verify_live.py` gets updated to reflect the new call shape and re-run against the real endpoint as the manual verification step, same as Phase 1's Task 9.

## Addendum (2026-08-24): fee_breakdown bug + itinerary routing field

After the 3-task plan shipped, a broader live pull (205 real records, vs. the smaller sample checked during Task 3) surfaced two things a final review caught:

**1. `fee_breakdown` bug.** `_compute_fees` originally did `fee_breakdown[key] = amount` (overwrite). Real responses can carry the *same* fee code twice — confirmed on a live DEL→BOM search returning a connecting itinerary where `RCS` (₹50) is charged once per leg. The top-level bucket sums (`base_fare`/`taxes`/`udf`/`convenience_fee`, which already used `+=`) were unaffected, but the itemized `fee_breakdown` dict silently dropped the duplicate, so `sum(fee_breakdown.values())` didn't always equal `total_fare` — on live data, ~22% of records. Fix: `fee_breakdown[key] = fee_breakdown.get(key, 0.0) + amount`.

**2. Connecting/alternate-airport itineraries aren't between the searched airports.** The search request's `searchOriginMacs`/`searchDestinationMacs: true` flags (present since the endpoint was first verified) return itineraries using *metro-area alternate airports*, not just the literal requested codes. A `origin="DEL", destination="BOM"` search returned real fare options actually routed `DXN-BLR` + `BLR-BOM` (Noida → Bengaluru → Mumbai) and `DEL-NMI` (Delhi → Navi Mumbai) — confirmed via the response's `serviceCharges[].detail` field, which names each flown leg (e.g. `"DEL-BOM"` for a genuine nonstop, or two entries `"DXN-BLR"`/`"BLR-BOM"` for a connection). Recording these under `origin=DEL, destination=BOM` without any indication of the actual routing would silently mix incomparable itinerary types into one route's price series — exactly the risk flagged in the final review.

**Decision:** keep every itinerary (don't filter to nonstop-only), and add a `routing: Optional[str]` field to `FareQuote` capturing the actual flown legs, derived from the distinct non-null, non-`"TaxSum"` `detail` values in `serviceCharges`, joined in first-seen order with `|` (e.g. `"DEL-BOM"` for nonstop, `"DXN-BLR|BLR-BOM"` for the connecting example above). This makes the itinerary type visible and filterable later (Phase 2/3 can decide to keep, weight, or exclude non-nonstop records) rather than silently blended in. Additive field, defaults to `None`, no other schema or call-site changes required.
