# SkyMetrics PostgreSQL + Docker Design

Date: 2026-08-26
Status: Approved for implementation

## Context

The project has run entirely on flat JSON/JSONL files since Phase 1, a deliberate YAGNI choice while data volume was tiny and only one source (Akasa Air) was live. Two things changed the calculus: the user plans to onboard scrapers for numerous additional airlines/OTA platforms, and the PRD names real institutional consumers ("an API that the NSO and RBI can consume") — a multi-client story past what flat files fit well. Docker is scoped together with the database (not deferred), since it removes Postgres's main deployment cost (a server process to run) via Docker Compose, and was already the natural next packaging step.

This sub-project moves the project's durable data (cleaned fare quotes, index snapshots) from git-committed flat files to PostgreSQL, and packages the API + dashboard with Docker Compose. `config/weights.json` and `config/service_ppi_reference.json` stay as flat files — small, rarely-updated, source-attributed config that doesn't benefit from being in a table, same reasoning already applied to both.

A real constraint drove two decisions during brainstorming: the daily GitHub Actions cron runs on GitHub's cloud infrastructure, not the user's Mac, so a Postgres instance reachable only via local Docker can't be written to by the cron. The database is therefore a free-tier managed cloud Postgres (**Neon** — chosen over Supabase because it's pure Postgres with nothing extra to reason about; Supabase bundles auth/storage/realtime this project doesn't need and already has its own API-key auth for), used as the single source of truth everywhere: local dev, the Docker Compose demo, and the cron.

## Goals

- Two new tables, `fare_quotes` and `index_points`, replacing `data/cleaned/*.jsonl` and `data/index/*.json` as the durable store.
- A one-time migration script backfilling the existing real committed data into Postgres.
- `api/data_access.py` rewritten to query Postgres instead of reading files, via a new `get_db_connection` FastAPI dependency (same override-in-tests pattern as the existing `get_index_base_dir`/`get_cleaned_base_dir`).
- `.github/workflows/daily-scrape.yml` rewritten so clean+build write straight to Postgres, removing the git-commit-of-data step shipped earlier today.
- A `docker-compose.yml` with two services (`api`, `dashboard`), both configured via env vars pointing at the same Neon database.
- Tests run against a real, ephemeral Postgres (a `postgres` service container in CI, and locally via Docker), not a substitute dialect like SQLite — avoids masking real Postgres-specific bugs.

## Non-goals

- No migration of `config/weights.json` or `config/service_ppi_reference.json` into tables — both stay flat files, per the reasoning above.
- No ORM (SQLAlchemy or similar). Raw SQL via `psycopg` matches this project's stdlib-first philosophy (FastAPI was the one prior justified exception); the actual query patterns here (insert, filter by date/route, fetch snapshots) don't need an ORM's abstraction.
- No connection pooling library (e.g. `pgbouncer`) in this phase — Neon's serverless driver handles connection management adequately at this scale; revisit only if real load demands it.
- No database migration/schema-versioning tool (e.g. Alembic) — the schema is created once via a plain SQL file (`db/schema.sql`) run manually; revisit if the schema needs to evolve after this ships and a real migration story becomes necessary.
- `data/raw/` is unaffected — stays gitignored, ephemeral, artifact-only, exactly as today.

## Design

### Schema (`db/schema.sql`)

```sql
CREATE TABLE fare_quotes (
    quote_id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    carrier TEXT NOT NULL,
    source TEXT NOT NULL,
    travel_date DATE NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    advance_window TEXT NOT NULL,
    fare_class TEXT,
    base_fare NUMERIC,
    taxes NUMERIC,
    udf NUMERIC,
    convenience_fee NUMERIC,
    total_fare NUMERIC,
    status TEXT NOT NULL,
    run_id TEXT NOT NULL,
    fee_breakdown JSONB,
    routing TEXT,
    is_outlier BOOLEAN NOT NULL,
    source_quote_ids TEXT[] NOT NULL
);

CREATE INDEX fare_quotes_origin_destination_idx ON fare_quotes (origin, destination);
CREATE INDEX fare_quotes_collected_at_idx ON fare_quotes (collected_at);

CREATE TABLE index_points (
    id BIGSERIAL PRIMARY KEY,
    comparison_id TEXT NOT NULL,
    frequency TEXT NOT NULL,
    period TEXT NOT NULL,
    base_period TEXT NOT NULL,
    routes TEXT[] NOT NULL,
    simple_relative NUMERIC NOT NULL,
    laspeyres NUMERIC,
    paasche NUMERIC,
    fisher NUMERIC,
    written_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX index_points_comparison_id_idx ON index_points (comparison_id);
CREATE INDEX index_points_frequency_period_idx ON index_points (frequency, period);
```

Every column maps directly to an existing field: `fare_quotes` mirrors `CleanedFareQuote.to_json_dict()` (`scraper/schema.py`'s `FareQuote` plus `pipeline/schema.py`'s `is_outlier`/`source_quote_ids`) field-for-field; `index_points` mirrors one point from `index/build.py`'s `build_series()` output, with `comparison_id` and `frequency` (previously only on the enclosing snapshot dict) now columns on every row so a snapshot's points can be queried without needing the old wrapper structure. `source_quote_ids` and `routes` use Postgres's native array type — a real Postgres feature the flat-file JSON approach couldn't use directly.

### Migration (`db/migrate_existing_data.py`)

One-time script: reads every `data/cleaned/*.jsonl` and `data/index/*.json` file (via the already-existing `index.build.load_all_cleaned_records()` for cleaned records, and direct JSON parsing for index snapshots), inserts each row into the corresponding Postgres table. Run once, manually, against the real Neon database. After a successful run, `data/cleaned/` and `data/index/` are removed from git tracking (`.gitignore` gets those two lines back) — the flat files' job is done once Postgres holds the same data.

### `api/data_access.py` rewrite

- New FastAPI dependency `get_db_connection()` in `api/main.py`, reading `DATABASE_URL` from the environment (no default, fails loudly if unset — same convention as `SKYMETRICS_API_KEYS`), overridable via `app.dependency_overrides` in tests (pointing at a test database instead of a `tmp_path` fixture).
- `list_snapshots()`, `load_snapshot()`, `filter_series()` become SQL queries against `index_points` (grouped/filtered by `comparison_id`, `frequency`, `period` range via `WHERE`, not Python-side filtering).
- `load_fare_records()` / `filter_fare_records()` become SQL queries against `fare_quotes` (`WHERE origin = ...`, date-range on `collected_at` — real indexed filtering, not scanning every JSONL file per request).
- `load_weights_metadata()` is unchanged — still reads `config/weights.json`.

### Cron rewrite (`.github/workflows/daily-scrape.yml`)

The clean and build steps write straight to Postgres instead of local files; the final git-commit-of-data step (added earlier today) is removed entirely — no more bot git identity, no more `pull --rebase` race handling, since Postgres handles concurrent writes natively. `DATABASE_URL` is added as a GitHub Actions repository secret. The raw-artifact upload step is unaffected (`data/raw/` stays local-to-the-run, ephemeral, unrelated to this change).

### Docker Compose (`docker-compose.yml`)

Two services:
- `api` — builds from a new `Dockerfile` (multi-stage: install `requirements.txt`, run `uvicorn`), reads `DATABASE_URL`/`SKYMETRICS_API_KEYS` from environment.
- `dashboard` — builds from a new `dashboard/Dockerfile` (multi-stage: `npm run build`, serve the static output, e.g. via a minimal static file server), reads `VITE_API_BASE_URL`/`VITE_API_KEY` at build time (Vite env vars are baked in at build, not runtime — matches the existing `.env`-based dev setup).

Both point at the same Neon `DATABASE_URL` — no local Postgres container in Compose (see Context: a second, out-of-sync local-only database would defeat "one source of truth"). A `.env.example` at the repo root documents the required variables.

### Testing

Tests that touch `fare_quotes`/`index_points` run against a real ephemeral Postgres, not a substitute dialect:
- `ci.yml` gains a `postgres:` service container (GitHub Actions' standard `services:` block) for the `api`/`db`-touching test jobs.
- Locally, developers run tests against a Postgres reachable via `DATABASE_URL` pointed at either a disposable local container (`docker run postgres`) or a scratch Neon branch — either works, the tests don't care which, only that it's real Postgres.
- Each test that writes data does so inside a transaction that's rolled back at the end (standard pytest-fixture pattern), so tests don't need to clean up after themselves or interfere with each other.

## Error handling

- `get_db_connection()` fails loudly (uncaught exception) if `DATABASE_URL` is unset or the connection fails — consistent with the project's existing fail-loud convention, no silent fallback to file-based storage.
- The migration script is a one-time, manually-run, non-idempotent operation by design (it's meant to run once against empty tables) — if run twice, primary-key conflicts on `quote_id` surface loudly as errors, which is the correct behavior (better than silently double-inserting or silently skipping).

## Verification plan

Same "verify against real data" discipline as every prior phase: run the migration script against the real Neon database with the real committed data, confirm row counts match the source files exactly, run the API locally against the migrated Postgres data and confirm all three endpoints return the same data they did before the migration, then `docker compose up` and confirm the containerized API + dashboard serve correctly against the same database.
