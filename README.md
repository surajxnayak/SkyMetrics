# SkyMetrics

Real-time Airfare Price Index (APIx) for India — Smart India Hackathon 2026
submission (problem statement SIH26056, MoSPI/DIID).

## Status

**Phases 1-4** (of 5 — see `docs/superpowers/specs/`) are complete:

- **Phase 1** — a working, robots.txt-compliant scraper for Akasa Air across
  3 city-pairs and 5 advance-purchase windows.
- **Phase 2** — a cleaning pipeline: de-duplication and IQR-based outlier
  flagging on raw fare quotes.
- **Phase 3** — index construction: simple relative, Laspeyres, Paasche, and
  Fisher formulas over real DGCA-weighted routes, with daily/weekly/monthly
  aggregation and versioned snapshots (`index/build.py`).
- **Phase 4** — a REST API (`api/`) serving the computed index, cleaned
  fares, and methodology metadata, and a React + TypeScript dashboard
  (`dashboard/`) covering all six PRD dashboard features: trend view,
  sector heatmap, lead-time elasticity, drill-down filtering, CSV export,
  and a data-quality panel.

Back-testing, documentation, and automated-test hardening (Phase 5) are next.

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

## Running the API

Requires `SKYMETRICS_API_KEYS` to be set to a comma-separated list of
valid keys before starting.

```bash
export SKYMETRICS_API_KEYS=dev-local-key
uvicorn api.main:app --reload
```

Interactive docs at `http://127.0.0.1:8000/docs`. All `/api/v1/*` endpoints
require an `X-API-Key` header matching one of the configured keys.

## Running the dashboard

```bash
cd dashboard
cp .env.example .env   # set VITE_API_KEY to match SKYMETRICS_API_KEYS below
npm install
npm run dev
```

Open `http://localhost:5173`. Requires the API (see above) running with a
matching key, e.g.:

```bash
export SKYMETRICS_API_KEYS=dev-local-key
uvicorn api.main:app --reload
```

The dashboard embeds its API key in the built JS bundle — acceptable for a
demo of non-sensitive, already-computed fare statistics (see
`docs/superpowers/specs/2026-08-25-phase4b-dashboard-design.md`'s non-goals
for the reasoning), not something to do for a real secret.

## Testing

```bash
pytest
ruff check .
cd dashboard && npm test && npm run build
```

## License

MIT — see `LICENSE`.
