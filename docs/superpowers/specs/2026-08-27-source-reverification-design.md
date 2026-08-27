# Source Re-verification — Design

## Purpose

`config/sources.json` records a live compliance audit of all 11 PRD-named airline/OTA
sources, last checked 2026-08-23/24. Only Akasa Air is currently `active`; the other 10
are `blocked_by_robots` (5) or `blocked_by_waf` (5). The user wants to expand scraper
coverage to more airlines/OTAs. Per standing project instruction, no source is ever
scraped by bypassing robots.txt, ToS, CAPTCHAs, or anti-bot/WAF protections — the only
legitimate way to "add" a source is to find one that's actually compliant. This
sub-project re-runs the exact same live verification against the 10 currently-blocked
sources, since site policies can change and it's been several days since the last check.

## Scope

Re-verify only. Update `config/sources.json` with fresh results. If any source is found
newly compliant, record that fact — building its scraper is explicitly deferred to a
separate future sub-project, not part of this one.

## Method

Two tiers, matching the original audit's methodology exactly (see
`docs/superpowers/specs/2026-08-23-repo-scaffold-and-phase1-scraper-design.md`):

- **`blocked_by_robots` sources** (SpiceJet, Air India Express, Cleartrip, EaseMyTrip,
  Ixigo): re-fetch `robots.txt` via a plain HTTP request and re-check the specific
  disallowed path recorded for each in `config/sources.json`'s `reason` field. A simple,
  scriptable check — no browser needed, since a robots.txt-level block isn't a
  connection-level block.
- **`blocked_by_waf` sources** (IndiGo, Air India, MakeMyTrip, Goibibo, Yatra): re-check
  with a real browser (this session's Chrome browser tool), not curl/urllib. The original
  finding was that these block at the TLS/connection level before robots.txt even loads,
  so a plain HTTP check can't distinguish "still blocked" from "curl-specific block, a
  real browser would succeed."

For each of the 10, the check answers exactly one question: is `robots.txt` now
reachable/permissive (or, for WAF cases, is the connection no longer blocked) at the same
path that caused the original `blocked` verdict? This is a policy/access check only — no
scraper logic, no data collection, no writes to any target site.

## Output

- `config/sources.json`: every one of the 10 entries gets an updated `checked_at` date.
  Any entry whose status changed gets its `status` and `reason` updated to reflect the
  new finding, worded the same way the original entries are (mechanism + evidence).
  Entries that are still blocked keep their existing `reason` text but get the new
  `checked_at` date, so the file continues to reflect when it was last actually verified
  rather than looking stale.
- A short results write-up (this spec doc gets a "Results" section appended after the
  checks run, rather than a separate report file — this is a single verification pass,
  not an ongoing report series).

## Non-goals

- Building a scraper for any newly-compliant source (separate future sub-project).
- Re-checking Akasa Air (already active, not in scope).
- Any technique that works around a robots.txt disallow or a WAF/connection-level block —
  if a source is still blocked, it stays blocked, full stop.
- Adding Playwright or any browser-automation library as a permanent project dependency —
  this is a one-off verification pass using this session's interactive browser tool, not
  new scraper infrastructure.

## Results (2026-08-27)

All 10 sources remain blocked, identical to the 2026-08-23/24 audit. Nothing has changed.

**`blocked_by_robots` (re-checked via plain HTTP `robots.txt` fetch):**

| Source | Disallow rule still present? |
|---|---|
| SpiceJet | Yes — `Disallow: https://www.spicejet.com/api/v1` unchanged |
| Air India Express | Yes — `Disallow: /flight-availability` unchanged |
| Cleartrip | Yes — `Disallow: /flights/search*` unchanged |
| EaseMyTrip | Yes — `Disallow: /flight-search/listing*` unchanged |
| Ixigo | Yes — `Disallow: /flights/search`, `/flights/review` unchanged |

**`blocked_by_waf` (re-checked with a real Chromium browser via Playwright, launched
temporarily for this check only — not added as a project dependency):**

| Source | Result |
|---|---|
| IndiGo | `robots.txt` returns HTTP 200 but renders an app-level "Something went wrong / contact customer support" error page — identical selective block to before, not a connection failure |
| Air India | `net::ERR_HTTP2_PROTOCOL_ERROR` on `robots.txt` — identical connection-level block |
| MakeMyTrip | `net::ERR_HTTP2_PROTOCOL_ERROR` on `robots.txt` — identical connection-level block |
| Goibibo | `net::ERR_HTTP2_PROTOCOL_ERROR` on `robots.txt` — identical connection-level block |
| Yatra | `net::ERR_HTTP2_PROTOCOL_ERROR` on `robots.txt` — identical connection-level block |

**Conclusion:** no source has become newly compliant since the last audit. Per this
sub-project's scope, no scraper work follows from this result — `config/sources.json`'s
`checked_at` dates were updated to 2026-08-27 to record that the audit is current as of
today. The original design (`docs/superpowers/specs/2026-08-23-repo-scaffold-and-phase1-
scraper-design.md`) already framed `config/sources.json` as "a live-checked, extensible
registry... re-verified on every run" rather than a one-time finding — this result
confirms that framing is still accurate, and the registry itself needed no structural
changes, only fresher timestamps.

The only currently-scrapable source remains Akasa Air. Real expansion of scraper coverage
requires one of the two paths not pursued in this sub-project: an official partner/
developer API, or genuinely new sources beyond the original 11 PRD-named ones.
