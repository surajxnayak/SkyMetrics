# SkyMetrics

Real-time Airfare Price Index (APIx) for India — Smart India Hackathon 2026
submission (problem statement SIH26056, MoSPI/DIID).

## Status

**Phases 1-3** (of 5 — see `docs/superpowers/specs/`) are complete:

- **Phase 1** — a working, robots.txt-compliant scraper for Akasa Air across
  3 city-pairs and 5 advance-purchase windows.
- **Phase 2** — a cleaning pipeline: de-duplication and IQR-based outlier
  flagging on raw fare quotes.
- **Phase 3** — index construction: simple relative, Laspeyres, Paasche, and
  Fisher formulas over real DGCA-weighted routes, with daily/weekly/monthly
  aggregation and versioned snapshots (`index/build.py`).

Dashboard and API are later phases.

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

## Cleaning and index construction

```bash
python3 -c "from pipeline.clean import clean_run; clean_run('<run_id>')"
python -m index.build
```

Cleans a raw run into `data/cleaned/<run_id>.jsonl`, then builds a versioned
APIx snapshot at `data/index/<comparison_id>.json` from every cleaned run on
disk.

## Testing

```bash
pytest
ruff check .
```

## License

MIT — see `LICENSE`.
