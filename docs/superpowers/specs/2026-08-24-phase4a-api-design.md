# SkyMetrics Phase 4a — REST API Design

Date: 2026-08-24
Status: Approved for implementation

## Context

Phases 1-3 (shipped) produce, on disk, everything the PRD's serving layer (§4.5, "API for NSO and RBI") needs to expose: `data/index/<comparison_id>.json` (versioned APIx snapshots from `index/build.py`), `data/cleaned/<run_id>.jsonl` (de-duplicated, outlier-flagged fare quotes from `pipeline/clean.py`), and `config/weights.json` (real DGCA-sourced route weights with source attribution). Phase 4 in the PRD's roadmap bundles "Dashboard + API" together, but they're two separable subsystems (PRD §4.4 and §4.5) with a dependency in one direction — the dashboard consumes the API, not the reverse. This spec covers **Phase 4a: the API only**. The dashboard (Phase 4b) is a separate, later spec that builds against this API once it exists.

Every prior phase in this project is Python stdlib-only. This phase deliberately introduces the project's first runtime dependency: FastAPI. The PRD itself names FastAPI for the serving layer (free, MIT-licensed), and the API's job here is light — reading and filtering already-computed files, no request-time computation — so there's no technical reason to avoid it, and real reasons to prefer it (auto-generated OpenAPI docs satisfy F-5.5 almost for free; it stays in the same language as every module it reads from, so it can `import index.weights` etc. directly with no cross-language bridge).

## Goals

- Implement all three data-serving endpoints the PRD names (F-5.1, F-5.2, F-5.3): APIx series by date range/frequency, cleaned route-level fare series, and methodology/weights/revision metadata.
- Auto-generated OpenAPI docs (F-5.5) via FastAPI — no hand-written spec.
- A real, minimal implementation of auth and rate limiting (F-5.4, "Should") — API-key header check + a simple in-memory per-key request cap — rather than skipping it or building a full role-based system neither justified by nor requested for a hackathon prototype with no actual multi-tenant user base yet.
- Expose the revision trail: every snapshot `index/build.py` has ever written stays individually fetchable by `comparison_id`, not just the latest.

## Non-goals

- No database. Every endpoint reads directly from the existing flat JSON/JSONL files on every request; no caching layer. Current and expected demo data volume (single-digit MB, low request rate) doesn't justify the invalidation complexity a cache would add — pure YAGNI, revisit only if profiling ever says otherwise.
- No Docker packaging in this sub-project. Not named as a Phase 4 roadmap deliverable specifically (only in the PRD's general tech-stack section); revisit once the dashboard exists too, so both serving-layer pieces can be containerized together if wanted.
- No on-demand recomputation endpoint. `index/build.py`, `pipeline/clean.py`, and the scraper stay manual/cron-driven CLI steps, exactly as today — this API only serves what's already on disk.
- No dashboard. That's Phase 4b, a separate spec, built against this API once it exists.
- No distributed or persistent rate-limit store (e.g. Redis) — in-memory, per-process, resetting on restart is a stated, acceptable limitation for a single-process demo deployment, not a gap to close here.

## Endpoints

All under `/api/v1`, all requiring the API key and subject to the rate limit — applied uniformly via one shared `APIRouter(dependencies=[...])` rather than a two-tier scheme, even though the PRD's wording calls out authentication explicitly only for the raw-series endpoint. `/docs` and `/openapi.json` (FastAPI's built-ins) are unauthenticated, as is standard — they describe the API, they aren't the data.

### `GET /api/v1/index` (F-5.1)

Query params:
- `frequency` (required): `"daily" | "weekly" | "monthly"`. Invalid value → 422 (Pydantic `Literal` validation, automatic).
- `comparison_id` (optional): pin to one specific snapshot. If given, that exact `data/index/<comparison_id>.json` file is loaded; 404 if the file doesn't exist, or if it exists but its own `frequency` field doesn't match the one requested.
- `start`, `end` (optional): period strings (e.g. `"2026-08-24"`, `"2026-W34"`, `"2026-08"` depending on frequency). Filters `series` to points whose `period` falls in `[start, end]` (inclusive), compared as plain strings — safe because `period_of` always emits zero-padded, lexicographically sortable strings within one frequency.

Behavior: without `comparison_id`, loads the most-recently-written snapshot on disk matching `frequency` (via `list_snapshots`). If no snapshot exists yet for that frequency at all → 404 (nothing's been built yet, not a 500).

Response: the snapshot's `comparison_id`, `frequency`, and the (possibly date-filtered) `series` list — each point as written by `index/build.py` (`period`, `base_period`, `routes`, `simple_relative`, and `laspeyres`/`paasche`/`fisher` when present).

### `GET /api/v1/fares` (F-5.2)

Query params (all optional): `origin`, `destination` (IATA codes, exact match), `start`, `end` (full ISO datetime strings; a record's `collected_at`, parsed as a datetime, must fall within `[start, end]` inclusive on both ends to match — either bound may be given alone).

Behavior: loads every record across all `data/cleaned/*.jsonl` files (via `index.build.load_all_cleaned_records`), applies the filters, returns the matching records as-is (full cleaned-record shape — every field `pipeline/clean.py` writes, not a trimmed subset), so a researcher gets the same route-level detail the PRD's "Economist / Researcher" persona needs (lead-time, seasonality, route breakdowns).

### `GET /api/v1/metadata` (F-5.3)

No query params. Returns the full contents of `config/weights.json` (`source`, `period`, `computed_at`, `weights` — the attribution fields, not just the bare weights dict that `index.weights.load_weights()` returns for its own computation-only purpose), a short static description of the four formulas (simple relative, Laspeyres, Paasche, Fisher — matching `index/formulas.py`'s docstrings), and the output of `list_snapshots()`: every `comparison_id` ever written, with its `frequency` and write timestamp — this *is* the revision trail (auditability), exposed directly.

## Data access layer

`api/data_access.py` — plain functions, no FastAPI import, independently testable:

- `list_snapshots(index_base_dir: Path = INDEX_BASE_DIR) -> list[dict]` — scans `*.json` under the dir, returns `{comparison_id, frequency, written_at}` per file (mtime as `written_at`, ISO-formatted), newest first.
- `load_snapshot(frequency: str, comparison_id: str | None, index_base_dir: Path = INDEX_BASE_DIR) -> dict` — resolves to a specific file (by `comparison_id`) or the newest matching `frequency`; raises `SnapshotNotFoundError` (a small custom exception) when nothing matches.
- `filter_series(series: list[dict], start: str | None, end: str | None) -> list[dict]`.
- `load_fare_records(cleaned_base_dir: Path = CLEANED_BASE_DIR) -> list[dict]` — delegates to `index.build.load_all_cleaned_records`.
- `filter_fare_records(records: list[dict], origin: str | None, destination: str | None, start: str | None, end: str | None) -> list[dict]`.
- `load_weights_metadata(weights_path: Path = WEIGHTS_PATH) -> dict` — reads `config/weights.json` directly (the whole payload).

`api/main.py` wires two FastAPI dependency functions, `get_index_base_dir()` and `get_cleaned_base_dir()`, that route handlers use via `Depends(...)` and that tests override via `app.dependency_overrides` to point at `tmp_path` fixtures — the standard FastAPI mechanism for exactly this, no monkeypatching of module globals needed.

## Auth (F-5.4)

`api/auth.py`: a FastAPI dependency reading the `SKYMETRICS_API_KEYS` environment variable (comma-separated valid keys) on every request and checking it against the `X-API-Key` request header. No default or hardcoded fallback key, matching the project's fail-loud convention: if the env var is unset, the check raises immediately and every request fails loudly and clearly (a 500 from the unhandled `RuntimeError`, not a silent pass-through or a guessable built-in key). Reading per-request rather than caching a module-level "valid keys" set is deliberate — it keeps the check a plain, order-independent function that tests can call directly with `monkeypatch`, rather than something whose behavior depends on what the environment looked like at whatever moment the module first happened to be imported. An env var, not a `config/*.json` file, because this holds secrets and every existing `config/*.json` file in this project is committed, non-secret data — using an env var avoids carving out one sensitive exception inside that directory. Missing/invalid key on a request → 401.

## Rate limiting (F-5.4)

`api/rate_limit.py`: an in-memory fixed-window limiter, `{api_key: (window_start, count)}`, capped at 60 requests/minute per key (hardcoded constant). A FastAPI dependency wraps it; exceeding the limit → 429. No external store — single-process, resets on restart, explicitly acceptable for a demo deployment.

## Error handling

- 401 — missing/invalid API key.
- 429 — rate limit exceeded.
- 422 — invalid `frequency` (automatic, via `Literal` typing).
- 404 — unknown `comparison_id`, a `comparison_id` whose frequency doesn't match the request, or no snapshot yet for a requested frequency. Raised in `data_access.py` as `SnapshotNotFoundError`, mapped to 404 by a FastAPI exception handler in `main.py`.
- Anything else (e.g. a corrupted on-disk file) propagates as a 500 uncaught — consistent with `pipeline/clean.py` and `index/build.py`'s existing fail-loud behavior; not a case to defensively paper over.

## Testing

FastAPI's built-in `TestClient` (in-process ASGI, no live server) — one test file per module, matching this project's existing convention:

- `tests/test_api_data_access.py` — pure-function tests against `tmp_path` fixtures, no FastAPI involved.
- `tests/test_api_auth.py`, `tests/test_api_rate_limit.py` — the two dependencies in isolation.
- `tests/test_api_main.py` — full endpoint tests via `TestClient`: all three routes, the 401/404/422/429 paths, and `/docs`/`/openapi.json` reachable without a key. Uses `app.dependency_overrides` to point at `tmp_path` fixtures.

## File layout

```
api/
  __init__.py
  main.py            # FastAPI app, routers, exception handlers, startup env-var check
  data_access.py      # list_snapshots, load_snapshot, filter_series, load_fare_records,
                       # filter_fare_records, load_weights_metadata, SnapshotNotFoundError
  auth.py              # require_api_key dependency, reads SKYMETRICS_API_KEYS
  rate_limit.py        # in-memory fixed-window limiter + FastAPI dependency
tests/
  test_api_data_access.py
  test_api_auth.py
  test_api_rate_limit.py
  test_api_main.py
requirements.txt       # new: fastapi, uvicorn
requirements-dev.txt    # gains: httpx (required by TestClient)
```

Running locally: `uvicorn api.main:app --reload`, documented in the README alongside the existing scraper/pipeline/index instructions.

## Verification plan

Same "verify against real, already-collected data" discipline as every prior phase: after implementation, run the API locally against the real files already on disk (`data/index/*.json`, `data/cleaned/*.jsonl`, `config/weights.json` from Phases 1-3) and demonstrate all three endpoints returning real data, plus the 401/404/422/429 error paths, before calling this sub-project done.
