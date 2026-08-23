# SkyMetrics

Real-time Airfare Price Index (APIx) for India — Smart India Hackathon 2026
submission (problem statement SIH26056, MoSPI/DIID).

## Status

**Phase 1** (of 5 — see `docs/superpowers/specs/`): a working, robots.txt-compliant
scraper for Akasa Air across 3 city-pairs and 5 advance-purchase windows.
Cleaning, index construction, dashboard, and API are later phases.

## Why only one live source right now

All 11 airline/OTA sources named in the problem statement were live-checked
for robots.txt and access-control compliance before any scraper was written.
Only Akasa Air currently permits it — see `config/sources.json` for the full
audit (status + reason per source) and
`docs/superpowers/specs/2026-08-23-repo-scaffold-and-phase1-scraper-design.md`
for how each was verified. This project does not circumvent robots.txt, ToS,
or anti-bot protections; a blocked source stays blocked until it's genuinely
compliant.

## Setup

Requires Python 3.11+. No runtime dependencies — the scraper is stdlib-only.

```bash
pip install -r requirements-dev.txt
```

## Running the scraper

```bash
python -m scraper.run
```

Writes raw fare quotes to `data/raw/<source>/<run_id>.jsonl`.

## Testing

```bash
pytest
ruff check .
```

## License

MIT — see `LICENSE`.
