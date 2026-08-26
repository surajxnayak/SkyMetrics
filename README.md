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

Back-testing against a real government reference series (Ministry of
Commerce's Service PPI) is also complete — see
`docs/superpowers/specs/2026-08-26-phase5-dgca-backtest-design.md` and the
generated `docs/validation-report.md`. Documentation and automated-test
hardening (the rest of Phase 5) are next.

Data storage moved from git-committed flat files to PostgreSQL, packaged
with Docker Compose — see
`docs/superpowers/specs/2026-08-26-postgres-docker-design.md`.

## Architecture

```
Akasa Air
    |
    v
scraper/run.py            (writes data/raw/*.jsonl, gitignored, ephemeral)
    |
    v
pipeline/clean.py   ----> PostgreSQL: fare_quotes
    |
    v
index/build.py      ----> PostgreSQL: index_points
                                |
                                v
                          api/main.py (FastAPI REST, api/data_access.py reads both tables)
                                |
                                v
                          dashboard/ (React + TypeScript, consumes the REST API)
```

| Directory   | Responsibility                                                  |
|-------------|------------------------------------------------------------------|
| `scraper/`  | Akasa Air scraper + compliance guard (robots.txt, rate limiting) |
| `pipeline/` | Cleaning: de-duplication, IQR outlier flagging                   |
| `index/`    | Index construction: formulas, weights, build, back-test          |
| `api/`      | FastAPI REST layer + Postgres data access                        |
| `dashboard/`| React + TypeScript dashboard                                     |
| `db/`       | Postgres schema + migration scripts                               |
| `config/`   | Source compliance audit, route weights                            |
| `docs/`     | Specs, plans, validation report                                   |

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

Requires Python 3.11+ and a PostgreSQL database (a free-tier
[Neon](https://neon.tech) instance works well — see `.env.example`).

```bash
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env   # fill in DATABASE_URL and SKYMETRICS_API_KEYS
export $(cat .env | xargs)
python3 -m db.apply_schema   # one-time: creates fare_quotes and index_points
```

## Running the scraper

```bash
python -m scraper.run
```

Writes raw fare quotes to `data/raw/<source>/<run_id>.jsonl` (gitignored,
ephemeral — only used as an intermediate before cleaning).

## Cleaning and index construction

```bash
python3 -c "from pipeline.clean import clean_run_to_db; from api.db import get_connection; clean_run_to_db('<run_id>', conn=get_connection())"
python3 -c "from index.build import build_and_write_series_to_db, load_all_cleaned_records; from index.weights import load_weights; from api.db import get_connection; build_and_write_series_to_db(load_all_cleaned_records(), 'daily', load_weights(), conn=get_connection())"
```

Cleans a raw run and writes a versioned APIx snapshot straight into
Postgres (`fare_quotes` and `index_points` tables) — no local flat files are
produced by this path. The daily GitHub Actions cron
(`.github/workflows/daily-scrape.yml`) runs this same sequence automatically.

## Running the API

Requires `SKYMETRICS_API_KEYS` (a comma-separated list of valid keys) and
`DATABASE_URL` to be set before starting.

```bash
export SKYMETRICS_API_KEYS=dev-local-key
export DATABASE_URL=postgresql://...
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
matching key.

The dashboard embeds its API key in the built JS bundle — acceptable for a
demo of non-sensitive, already-computed fare statistics (see
`docs/superpowers/specs/2026-08-25-phase4b-dashboard-design.md`'s non-goals
for the reasoning), not something to do for a real secret.

## Running with Docker

Requires Docker and Docker Compose (both included in Docker Desktop).

```bash
cp .env.example .env   # fill in DATABASE_URL (a real Postgres, e.g. from neon.tech) and SKYMETRICS_API_KEYS
docker compose up --build
```

API at `http://localhost:8000`, dashboard at `http://localhost:5173`. Both
containers connect to the same Postgres database specified in
`DATABASE_URL` — this project no longer stores durable data in
git-committed flat files (see
`docs/superpowers/specs/2026-08-26-postgres-docker-design.md`).

## Testing

Tests that touch the database run against a real PostgreSQL instance (never
a substitute dialect like SQLite, to avoid masking real Postgres-specific
bugs) — either the same database configured in `DATABASE_URL`, or CI's
disposable `postgres:` service container.

```bash
export $(cat .env | xargs)   # DATABASE_URL must be set for DB-backed tests
pytest
ruff check .
cd dashboard && npm test && npm run build
```

## License

MIT — see `LICENSE`.
