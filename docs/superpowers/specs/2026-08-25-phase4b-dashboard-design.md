# SkyMetrics Phase 4b — Dashboard Design

Date: 2026-08-25
Status: Approved for implementation

## Context

Phase 4a (shipped, pushed) built the REST API (PRD §4.5) that serves everything the dashboard (PRD §4.4) needs: `GET /api/v1/index` (versioned APIx snapshots), `GET /api/v1/fares` (cleaned, route-level fare records), and `GET /api/v1/metadata` (DGCA weights/attribution, formula descriptions, revision history). The PRD bundles "Phase 4: Dashboard + API" together in its roadmap, but they were split into two sequential sub-projects — API first, then a dashboard consuming it (see the Phase 4a design spec). This spec covers Phase 4b: the dashboard.

Every prior phase in this project is Python. This is the project's first JavaScript/TypeScript code. The PRD names React + Recharts/Plotly for the serving layer's UI half; this spec follows that with React + TypeScript + Vite + Recharts — free/open-source throughout, matching the project-wide constraint.

## Goals

- Implement all six dashboard features the PRD names (§4.4): trend view (F-4.1), sector heatmap (F-4.2), lead-time elasticity (F-4.3), drill-down filtering (F-4.4), CSV export (F-4.5), and a data-quality panel (F-4.6) — including the three "Should"-priority items, built in real, minimal-but-working form rather than skipped, matching this project's established pattern (Phase 3's back-test module, Phase 4a's rate limiting).
- Consume the existing Phase 4a API exactly as it stands today — no new backend endpoints. Any filtering or aggregation the API doesn't already do happens client-side over the fetched result set.
- A CORS policy on the API (the one necessary backend change), so a browser can call it at all.

## Non-goals

- No Docker packaging — deferred again (Phase 4a already deferred it once, pending the dashboard's existence; it's deferred a second time here, to a later dedicated deployment task once both serving-layer pieces are feature-complete).
- No backend-for-frontend proxy. The dashboard calls the API directly with an embedded demo API key. **This is a known, deliberate limitation**: anyone opening browser devtools can see the key. Accepted because (a) the underlying data is already-computed, non-sensitive fare statistics, not a secret or a paid resource, (b) the API's existing rate limit (60 req/min/key) still applies regardless of how the key leaked, and (c) building a proxy is real, untested new infrastructure to defend against a threat model that doesn't exist for this data. A production deployment serving genuinely sensitive data would need a real proxy or session-based auth; this is explicitly a round-1 prototype.
- No new API filtering capability. `carrier`, `advance_window`, and `fare_class` drill-down filters are applied client-side over whatever `/api/v1/fares` already returned (filtered server-side only by `origin`/`destination`), rather than extending `filter_fare_records`'s signature and reopening Phase 4a's already-reviewed test suite. Justified by current data volume (a few hundred records per city-pair) — revisit if a route ever returns enough records that client-side filtering becomes slow.
- No persistence of filter/tab state across page reloads (URL params or `localStorage` would be a reasonable future addition, not needed for a demo).
- No offline/caching layer (e.g. TanStack Query) — plain `fetch` + React hooks. The dashboard's data doesn't change during a session (the underlying files are only updated by a manual/cron pipeline run), so there's nothing to invalidate or refetch-on-focus.

## Layout

Sidebar + tabs (chosen over a single-scroll page or per-tab filter bars): a persistent left sidebar holds every filter — frequency, date range, city-pair, carrier, advance window, fare class — plus the data-quality panel (F-4.6), all visible regardless of which tab is active. The main area has three tabs (Trend, Heatmap, Elasticity), each showing one large chart plus its own export button. This matches the PRD's framing of drill-down (F-4.4) as a filter that applies broadly, not a per-view concern — one shared filter state, not three independent ones.

Filter state lives in one React context (`FilterContext`) so switching tabs never resets what you've drilled into.

## Feature → component mapping

| PRD ID | Feature | Component | Data source & computation |
|---|---|---|---|
| F-4.1 | Trend view | `TrendView.tsx` | `GET /api/v1/index?frequency=...`. Renders `simple_relative`/`laspeyres`/`paasche`/`fisher` over `period` as a multi-line Recharts `LineChart`. Frequency selector (daily/weekly/monthly) lives in the sidebar; the snapshot's `base_period` is called out in the chart's title/legend. |
| F-4.2 | Sector heatmap | `SectorHeatmap.tsx` | `GET /api/v1/fares` (server-side filtered by the active city-pair if one is selected, otherwise all routes), grouped client-side into mean `total_fare` per (route, period). Rendered as a hand-built grid (route rows × period columns, cell background color scaled to fare level) — Recharts has no first-class heatmap primitive, and switching charting libraries for one chart isn't worth it. |
| F-4.3 | Lead-time elasticity | `LeadTimeElasticity.tsx` | `GET /api/v1/fares`, grouped client-side by `advance_window` (the five PRD-defined windows: T+1/7/15/30/45) for the active route(s), averaged to mean `total_fare` per window. Rendered as a Recharts `LineChart` with `advance_window` ordered from farthest to nearest, showing fares rise as travel date nears. |
| F-4.4 | Drill-down | Sidebar filter state — no dedicated view | City-pair (origin/destination) filtering happens server-side via `/api/v1/fares` query params; carrier, advance window, and fare class filtering happen client-side over the returned records (see Non-goals). Every other component reads the active filters from `FilterContext`. |
| F-4.5 | Export | `ExportButton.tsx`, one instance per view | Client-side CSV generation (build a CSV string from the view's currently-loaded/filtered data, wrap in a `Blob`, trigger a synthetic `<a download>` click) — no backend involvement, exports exactly what's on screen. |
| F-4.6 | Data-quality panel | `DataQualityPanel.tsx`, pinned in the sidebar | Derived client-side from `/api/v1/fares` (unfiltered by drill-down, so it always reflects overall data health): coverage = fraction of *expected* (route × advance_window) combinations present at least once, where "expected" means the 3 routes named in `/api/v1/metadata`'s `weights` (`DEL-BOM`, `DEL-BLR`, `BOM-BLR`) crossed with the 5 PRD-defined advance windows (T+1/7/15/30/45) — 15 combinations total; outlier rate = count of `is_outlier: true` records ÷ total; source health = count of `status: "available"` vs `"no_flight"` records. Real numbers computed from real Phase 1-3 output, not placeholders. |

## Data fetching and auth

`src/api/client.ts` is a thin wrapper: a base URL (read from a Vite env var, `VITE_API_BASE_URL`, defaulting to `http://127.0.0.1:8000`) and the demo API key (`VITE_API_KEY`, also a Vite env var — not hardcoded in source, but still shipped in the built JS bundle, which is the accepted limitation named above), attached as the `X-API-Key` header on every request. Three hooks (`useIndexSeries`, `useFares`, `useMetadata`) wrap `client.ts` with `useState`/`useEffect`, exposing `{data, loading, error}` — no caching library, per the Non-goals.

## Backend change: CORS

`api/main.py` currently has no CORS policy at all — a browser origin can't call it. This phase adds:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["X-API-Key"],
)
```

`allow_methods` is `["GET"]` only, since that's every method this API exposes today (adding a method later means touching this line, which is the point — no blanket `["*"]`). `allow_origins` is the Vite dev server's default origin; a real deployment would add its actual origin here. A new test in `tests/test_api_main.py` confirms a preflight `OPTIONS` request from the configured origin succeeds with the expected CORS headers, and that an arbitrary other origin does not receive them.

## File layout

```
dashboard/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  .env.example              # documents VITE_API_BASE_URL / VITE_API_KEY, not committed with real values
  src/
    main.tsx
    App.tsx                  # sidebar + tab shell
    context/
      FilterContext.tsx       # shared filter state: frequency, date range, city-pair, carrier, window, fare class
    api/
      client.ts               # fetch wrapper: base URL + X-API-Key header + error handling
      types.ts                 # TS types matching api/main.py's response shapes
    components/
      Sidebar.tsx
      TrendView.tsx
      SectorHeatmap.tsx
      LeadTimeElasticity.tsx
      DataQualityPanel.tsx
      ExportButton.tsx
    hooks/
      useIndexSeries.ts
      useFares.ts
      useMetadata.ts
  src/__tests__/
    client.test.ts
    TrendView.test.tsx
    SectorHeatmap.test.tsx
    LeadTimeElasticity.test.tsx
    DataQualityPanel.test.tsx
    ExportButton.test.tsx
```

## Testing

Vitest (Vite's own test runner) + React Testing Library, both free/OSS — the natural pairing with Vite, no build tooling beyond what Vite already needs. One test file per component/module, matching this project's existing one-file-per-module convention. `client.ts` is tested with `fetch` mocked (via `vi.fn()`); each component is tested with the relevant hook mocked, asserting on rendered output (e.g., given a mocked `/api/v1/fares` response, the heatmap renders the right number of cells with the right values; given a mocked `/api/v1/index` response, the trend chart's data matches).

## Verification plan

Same "verify against real, already-collected data" discipline as every prior phase: after implementation, run `uvicorn api.main:app` (with the new CORS policy) and `npm run dev` (the Vite dashboard) side by side, and demonstrate all six features against the real Phase 1-3 data already on disk — not just component tests with mocked data — before calling this phase done.
