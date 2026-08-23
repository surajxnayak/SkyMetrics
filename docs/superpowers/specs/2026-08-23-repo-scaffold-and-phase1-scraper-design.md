# SkyMetrics — Repo Scaffold + Phase 1 Scraper Design

Date: 2026-08-23
Status: Approved for implementation

## Context

SkyMetrics is a Smart India Hackathon 2026 submission (problem statement SIH26056, MoSPI/DIID) building a Real-time Airfare Price Index (APIx) for India. Full scope per the PRD: a scraping engine across 5 airline portals and 6 OTAs, a cleaning pipeline, an index-construction module, a dashboard, and a public API, built entirely on free/open-source tooling.

This spec covers only the first slice: a professional repo foundation plus Phase 1 of the PRD's own roadmap ("scraper for 1-2 sources, 2-3 city-pairs — working raw collection with provenance"). Cleaning, index construction, dashboard, and API are separate future specs, per the PRD's phased roadmap (§9).

## Compliance findings (drives this design)

Before writing any scraper, we live-checked robots.txt for all 11 sources the PRD/problem statement name — and, critically, traced where each source's *actual* search data lives, not just its robots.txt path prefixes:

| Source | Type | Status | Reason |
|---|---|---|---|
| Akasa Air | Airline | **Active** | `www.akasaair.com` robots.txt fully open; its booking backend `prod-bl.qp.akasaair.com` (a separate domain) has no robots.txt at all (404 = default allow) |
| SpiceJet | Airline | Blocked (robots) | Its search widget's real data call is `www.spicejet.com/api/v1/search/getStationDetails` — and robots.txt explicitly disallows `https://www.spicejet.com/api/v1`. (Initially misread as "active" by only checking path prefixes without tracing the actual search flow — corrected after live verification.) |
| Air India Express | Airline | Blocked (robots) | Disallows `/flight-availability` |
| IndiGo | Airline | Blocked (WAF) | Connection blocked at TLS/edge level before robots.txt loads |
| Air India | Airline | Blocked (WAF) | Same as IndiGo |
| Cleartrip | OTA | Blocked (robots) | Disallows `/flights/search*` |
| EaseMyTrip | OTA | Blocked (robots) | Disallows `/flight-search/listing*` |
| Ixigo | OTA | Blocked (robots) | Disallows `/flights/search`, `/flights/review` |
| MakeMyTrip | OTA | Blocked (WAF) | Connection blocked at TLS/edge level |
| Goibibo | OTA | Blocked (WAF) | Connection blocked at TLS/edge level |
| Yatra | OTA | Blocked (WAF) | Connection blocked at TLS/edge level |

Zero of the six named OTAs currently permit scraping their fare-search results. This matches the PRD's own risk #2 ("anti-bot/ToS limits → fall back to compliant sources, never circumvent," §11) and non-goal ("does not attempt to defeat, bypass or circumvent CAPTCHAs or anti-bot protections," §1.3).

**Akasa Air's real endpoint (live-verified 2026-08-23):**

```
GET https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search
    ?origin={IATA}&destination={IATA}&startDate={ISO8601}&numberOfPassengers=1&channel=WEB&currencyCode=INR
```

Confirmed via plain `curl` with no cookies, session, or auth token — genuinely public. Returns 31 days of `{date, price, isLowest, soldOut, noFlights}` starting from `startDate`. This is a blended lowest-fare-per-day figure, not a fare-class/component breakdown — `base_fare`/`taxes`/`udf`/`convenience_fee` are not available from this endpoint and are left null in Phase 1 records; decomposition is a Phase 2 (cleaning pipeline) concern per the PRD's own phase split (F-2.1 lives in §4.2, not §4.1). Two calls per route (`startDate=today` and `startDate=today+16`) cover all five advance-purchase windows (T+1 through T+45) inside two 31-day windows.

Because this is a plain authenticated-free JSON API, **Phase 1 needs no browser automation** — a stdlib `urllib.request` call is sufficient. Playwright is dropped from Phase 1 entirely; it becomes relevant again only if a future source's data genuinely requires JS rendering.

**Decision:** the source list is a live-checked, extensible registry, not a hardcoded include list. Phase 1 ships a full working scraper for the one currently-active source (Akasa Air). Every other named source is present in the registry with its checked status and reason, re-verified on every run — a source only scrapes if its live check says active, and any source can move to active later (changed robots.txt, an official API/partnership, or a corrected trace of where its real data lives) without touching scraper code for other sources.

Validation data (out of scope for this phase, noted for later): DGCA's own site (`dgca.gov.in`) publishes monthly average-fare/traffic data; MoSPI's `esankhyiki.mospi.gov.in` (robots.txt fully open) hosts an official CPI Transport & Communication sub-group series via its `/viz/cpi` dashboard, useful as a second back-test signal alongside DGCA in Phase 5.

## Goals

- Professional repo foundation: license, gitignore, CI, structured layout.
- A working, ethically-compliant scraper for Akasa Air across 3 city-pairs and all 5 advance-purchase windows, with full provenance.
- A compliance guard that is a first-class, tested component gating every request — not a formality.
- A transparent, auditable source registry covering all 11 PRD-named sources.

## Non-goals (this phase)

- Cleaning/normalisation pipeline, index construction, dashboard, or public API (later specs).
- Any circumvention of robots.txt, ToS, CAPTCHAs, or anti-bot measures (permanent non-goal per PRD §1.3).
- Standing up MongoDB/Postgres — raw storage is flat files for now (see below).

## Repo layout

```
SkyMetrics/
  scraper/
    sources/          # akasa.py — one module per active source
    compliance.py      # robots.txt fetch+cache, disallow check, rate limiter
    base.py             # BaseScraper interface
    schema.py            # fare-record schema + validation + advance-window constants
    storage.py            # JSONL writer with provenance
    run.py                 # CLI entrypoint
  config/
    sources.json             # registry of all 11 sources + live compliance status
    basket.json               # city-pairs
  tests/
    scraper/                    # unit tests, mirroring scraper/ — no live network calls
  .github/workflows/
    ci.yml                        # lint + pytest on push/PR
    daily-scrape.yml               # scheduled run (GitHub Actions free tier)
  data/raw/                        # gitignored output
  .gitignore
  LICENSE                          # MIT
  README.md
  pyproject.toml
```

No stub directories for `pipeline/`, `index/`, `api/`, or `dashboard/` yet — those get created when their phases start. Config is JSON, not YAML — Phase 1 has no hand-editing admin persona yet (that's a later PRD feature, §2), so stdlib `json` covers it with zero added dependency.

## Components

**Compliance guard (`compliance.py`)** — fetches and caches each domain's robots.txt via stdlib `urllib.robotparser` (TTL ~1h), checks every request path against it before firing, and enforces a minimum interval between requests to the same domain (default 5s). Built and tested before any scraper logic depends on it.

**Source registry (`config/sources.json`)** — all 11 sources with `status`, `checked_at`, and `reason` fields per the compliance table above. `compliance.py` re-verifies live on every run; the config value is a cache/audit record, not the enforcement mechanism.

**Scraper (`scraper/sources/akasa.py`)** — plain `urllib.request` HTTP calls, no browser automation needed (see endpoint finding above). Implements `BaseScraper.fetch_quotes(origin, destination, run_id) -> list[FareQuote]`, issuing two calendar calls per route to cover all five advance-purchase windows. Basket: DEL-BOM, DEL-BLR, BOM-BLR. Sold-out/no-flight are recorded as explicit status values (`total_fare=None`), never silently dropped.

**Storage (`storage.py`)** — JSONL under `data/raw/<source>/<run_id>.jsonl`, one record per quote following the PRD §6.2 schema (quote_id, origin, destination, carrier, source, travel_date, collected_at, advance_window, fare_class, base_fare, taxes, udf, convenience_fee, total_fare, status). `fare_class`/`base_fare`/`taxes`/`udf`/`convenience_fee` are null for Akasa in Phase 1 (see endpoint finding above) — populating them is Phase 2's job once a fare-component-level source or endpoint is wired in.

**Scheduling (`.github/workflows/daily-scrape.yml`)** — runs `scraper/run.py` on a daily cron via GitHub Actions free tier.

**Testing** — pytest covering compliance guard logic (robots.txt parsing via `RobotFileParser.parse()` on canned rule sets, rate-limit timing) and the Akasa scraper's response-mapping logic (via `unittest.mock` patching `urllib.request.urlopen` with canned JSON) — CI never makes a live network call. `ci.yml` runs lint (`ruff`) + `pytest` on every push/PR.

**License** — MIT.

## Open questions for later phases

- Whether tracing the real search-widget network calls (the same technique that corrected SpiceJet's status) turns up a genuinely-compliant path for Air India Express, or a browser-based recheck clears any WAF-blocked source.
- Whether eSankhyiki's `api.mospi.gov.in` backend is reachable from a normal network (unreachable from this session's sandbox) — relevant to Phase 5 back-testing, not this phase.
- DGCA's public data (traffic/passenger volumes, not fares) is useful for route-weight validation (PRD F-3.1), not fare back-testing — the PRD's "DGCA monthly average-fare data" (§3.3, §5.4) assumption doesn't match what DGCA actually publishes; the CPI Transport & Communication sub-group (eSankhyiki) is the closer fit for back-testing fare *trends*.
