# SkyMetrics — Repo Scaffold + Phase 1 Scraper Design

Date: 2026-08-23
Status: Approved for implementation

## Context

SkyMetrics is a Smart India Hackathon 2026 submission (problem statement SIH26056, MoSPI/DIID) building a Real-time Airfare Price Index (APIx) for India. Full scope per the PRD: a scraping engine across 5 airline portals and 6 OTAs, a cleaning pipeline, an index-construction module, a dashboard, and a public API, built entirely on free/open-source tooling.

This spec covers only the first slice: a professional repo foundation plus Phase 1 of the PRD's own roadmap ("scraper for 1-2 sources, 2-3 city-pairs — working raw collection with provenance"). Cleaning, index construction, dashboard, and API are separate future specs, per the PRD's phased roadmap (§9).

## Compliance findings (drives this design)

Before writing any scraper, we live-checked robots.txt for all 11 sources the PRD/problem statement name:

| Source | Type | Status | Reason |
|---|---|---|---|
| Akasa Air | Airline | **Active** | robots.txt fully open |
| SpiceJet | Airline | **Active** | robots.txt disallows only `/cgi-bin/`, `/api/v1`, `/public/`, `/externalBooking` — booking flow unaffected |
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

**Decision:** the source list is a live-checked, extensible registry, not a hardcoded include list. Phase 1 ships full working scrapers for the two currently-active sources (Akasa Air, SpiceJet). Every other named source is present in the registry with its checked status and reason, re-verified on every run — a source only scrapes if its live check says active, and any source can move to active later (changed robots.txt, browser-based recheck clearing a false WAF block, an official API/partnership) without touching scraper code.

Validation data (out of scope for this phase, noted for later): DGCA's own site (`dgca.gov.in`) publishes monthly average-fare/traffic data; MoSPI's `esankhyiki.mospi.gov.in` (robots.txt fully open) hosts an official CPI Transport & Communication sub-group series via its `/viz/cpi` dashboard, useful as a second back-test signal alongside DGCA in Phase 5.

## Goals

- Professional repo foundation: license, gitignore, CI, structured layout.
- A working, ethically-compliant scraper for Akasa Air + SpiceJet across 3 city-pairs and all 5 advance-purchase windows, with full provenance.
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
    sources/          # akasa.py, spicejet.py — one module per active source
    compliance.py      # robots.txt fetch+cache, disallow check, rate limiter
    base.py             # BaseScraper interface
    schema.py            # fare-record schema + validation
    storage.py            # JSONL writer with provenance
    run.py                 # CLI entrypoint
  config/
    sources.yaml            # registry of all 11 sources + live compliance status
    basket.yaml               # city-pairs + advance-purchase windows
  tests/
    fixtures/                   # saved HTML snapshots for offline parser tests
  .github/workflows/
    ci.yml                        # lint + pytest on push/PR
    daily-scrape.yml               # scheduled run (GitHub Actions free tier)
  data/raw/                        # gitignored output
  .gitignore
  LICENSE                          # MIT
  README.md
  pyproject.toml
```

No stub directories for `pipeline/`, `index/`, `api/`, or `dashboard/` yet — those get created when their phases start.

## Components

**Compliance guard (`compliance.py`)** — fetches and caches each domain's robots.txt (TTL ~1h), checks every request path against it before firing, honors `Crawl-delay` if present else a conservative default (5s between requests to the same domain), logs every allow/deny decision for the audit trail. This is built and tested before any scraper logic depends on it.

**Source registry (`config/sources.yaml`)** — all 11 sources with `status`, `checked_at`, and `reason` fields per the compliance table above. `compliance.py` re-verifies live on every run; the config value is a cache/audit record, not the enforcement mechanism.

**Scrapers (`scraper/sources/*.py`)** — Playwright-based (fare search is JS-rendered). Each implements `BaseScraper.fetch_quotes(origin, dest, travel_date) -> list[FareQuote]`. Basket: DEL-BOM, DEL-BLR, BOM-BLR. Windows: T+1/7/15/30/45. Sold-out/cancelled/no-flight are recorded as explicit status values, never silently dropped.

**Storage (`storage.py`)** — JSONL under `data/raw/<source>/<run-timestamp>.jsonl`, one record per quote validated against the PRD §6.2 schema (quote_id, origin, destination, carrier, source, travel_date, collected_at, advance_window, fare_class, base_fare, taxes, udf, convenience_fee, total_fare, status), with run provenance.

**Scheduling (`.github/workflows/daily-scrape.yml`)** — runs `scraper/run.py` on a daily cron via GitHub Actions free tier.

**Testing** — pytest covering compliance guard logic (robots.txt parsing, rate-limit timing) and per-source parsers against saved HTML fixtures, so CI never depends on live network access. `ci.yml` runs lint + tests on every push/PR.

**License** — MIT.

## Open questions for later phases

- Whether a browser-based (Playwright) recheck can clear any of the WAF-blocked sources — worth attempting once the compliance guard exists, since it already needs a real browser engine for JS rendering.
- Whether eSankhyiki's `api.mospi.gov.in` backend is reachable from a normal network (unreachable from this session's sandbox) — relevant to Phase 5 back-testing, not this phase.
