# Dashboard Redesign v2 — Design

## Purpose

The user supplied 4 complete HTML/Tailwind mockups (Trend Analysis, Sector Heatmap,
Lead-Time Elasticity, Data Drill-down) representing a new visual direction for the
SkyMetrics dashboard: a denser, terminal/Bloomberg-style dark UI with Material Symbols
icons, a collapsible icon-rail navigation, and a broader Material-3-inspired color/type
system. This sub-project translates that visual direction into the real dashboard
(`dashboard/src/`), which currently has a working, tested, previously-reviewed dark theme
(violet accent, shipped earlier this session).

## Scope

**Visual/structural restyle only, using only data the API already provides.** Per the
approved scope decision, the following are explicitly excluded from this sub-project (see
Non-goals): period-over-period % deltas, an elasticity coefficient, a volatility/spike
index, time-band volume distribution, and an alerts feed. None of these are computable
from data the backend exposes today; building them is separate future work.

## Design tokens

Add to `dashboard/src/index.css`'s `@theme` block (extending, not replacing, the existing
`--color-page/panel/inset/line/primary/secondary/muted/accent/accent-hover/accent-muted/
up/down/error/warning` tokens, which stay as-is and keep being used where they already
fit):

| New token | Value | Source in mockups | Purpose |
|---|---|---|---|
| `--color-surface-container` | `#1c2025` | `surface-container` | nav rail / header background |
| `--color-surface-container-low` | `#181c21` | `surface-container-low` | secondary panel background |
| `--color-surface-container-high` | `#272a30` | `surface-container-high` | active nav item background |
| `--color-surface-container-highest` | `#31353b` | `surface-container-highest` | hover states |
| `--color-outline-variant` | `#3c494c` | `outline-variant` | hairline borders (replaces ad hoc border colors) |
| `--color-on-surface-variant` | `#bbc9cd` | `on-surface-variant` | secondary/muted text on dark surfaces |

Standardized on the **violet accent** (`--color-accent`, already `#a78bfa`) across all 4
pages — the mockups inconsistently used purple on 3 pages and cyan on one (Sector
Heatmap); violet matches the brand already established and 3 of 4 mockups.

New type scale (added as Tailwind `@theme` `--font-size-*` / `--font-weight-*` utilities,
or plain utility classes composed from existing `font-sans`/`font-mono` — implementer's
call which is cleaner in Tailwind v4):

| Name | Size | Font | Use |
|---|---|---|---|
| `label-caps` | 11px, 0.08em tracking, 500 weight | mono | uppercase micro-labels (nav labels, table headers, KPI card labels) |
| `headline-md` | 24px, 600 weight | sans | page titles |
| `data-lg` | 20px, 600 weight | mono | KPI card values |
| `data-sm` | 13px | mono | table cell values (already achieved today via `font-mono text-sm`; formalize as a named scale for consistency) |

## Icon font

Add Material Symbols Outlined via Google Fonts `@import` in `index.css`, same pattern as
the existing Inter/JetBrains Mono import. Used for: nav icons (`show_chart`, `grid_view`,
`analytics`, `database`), header icons (`refresh`, `warning`, `search`), and action icons
(`download` on `ExportButton`).

## Navigation restructure

Replace `App.tsx`'s current fixed 288px sidebar + top tab bar with:

- **A collapsible icon rail** (56px, expands to 240px on hover — matches the mockups'
  `sidebar-thin` pattern), containing the SkyMetrics wordmark/logo and 4 page links
  (Trend / Heatmap / Elasticity / Drill-down), replacing the current `role="tablist"`
  button row. **Preserve the existing ARIA tab pattern** (`role="tablist"`/`"tab"`/
  `aria-selected`/`"tabpanel"`) even though the visual form changes from horizontal tabs
  to a vertical nav list — screen readers should still announce it as tabbed content.
- **A TopAppBar** (fixed, left-offset by the rail width) showing the current page title
  and existing global actions.
- **Filters stay a persistent, always-visible panel** (not the mockups' hover-flyout) —
  the real `Sidebar.tsx` has 7 real filter controls (frequency, time-range preset +
  custom dates, routes multi-select, sources multi-select, carrier, advance window, fare
  class) versus the mockup's 3-field flyout; a flyout would be a real usability
  regression. It moves out of the old 288px block into its own clearly-bordered panel
  alongside or below the TopAppBar — exact placement is an implementation-time layout
  call, but it must remain visible without a hover interaction.
- `DataQualityPanel` becomes a row of small KPI-card-styled stats (Coverage / Outliers
  flagged / Available vs no-flight) instead of plain text lines, using the new
  `data-lg`/`label-caps` type scale — same 4 real numbers `computeStats()` already
  returns, no new metrics.

## Per-component changes

- **`TrendView.tsx`**: **correction post-approval** — this component no longer plots the
  four index formulas (that data source, `useIndexSeries`/`getIndex`, is unused dead code
  as of the `dataCheck` branch merge). It now plots mean fare per selected route over
  time, via `useFares`. The KPI summary row is adjusted accordingly: one small card per
  currently-plotted route, showing that route's latest (most recent period's) mean fare —
  derived client-side from the already-fetched `chartData`, no new API calls. **No %
  delta.** Recharts chart restyled with the new tokens (grid/axis/tooltip colors,
  `label-caps` for axis ticks) — stays Recharts, not hand-rolled SVG.
- **`SectorHeatmap.tsx`**: keep the existing single-scale violet intensity encoding by
  absolute mean fare (`colorFor()`'s logic is unchanged) — **not** the mockup's diverging
  red/green %-change bands, since that requires a baseline/reference-period concept that
  doesn't exist yet. Restyle borders/typography/table chrome only. Per-period columns stay
  driven by whatever `frequency` is actually selected (daily/weekly/monthly), not
  hardcoded to per-day like the mockup.
- **`LeadTimeElasticity.tsx`**: restyle the existing mean-fare-vs-advance-window chart.
  **Drop** the mockup's Route Volatility Index table, Elasticity Coefficient KPI, Elasticity
  Alerts feed, and Time-Band Distribution bars — none of these are computable from current
  data (booking volume/counts aren't tracked at all, only price quotes).
  Recharts stays as the charting library.
- **`RawListView.tsx`**: restyle the existing 11-column table (already covers everything
  the mockup's Data Drill-down table shows: route, carrier, fare class, dates, price
  breakdown) with the new density/typography. **Drop** the mockup's "Cols" column-picker
  button (not supported today) and its fake pagination controls — the table already
  renders all matching records; adding real pagination is a separate feature, not styling.
- **`ExportButton.tsx`**: add the `download` Material Symbol icon next to the existing
  label; keep existing disabled-state handling as-is (already correct per earlier review).

## Testing

All 42 existing Vitest tests must still pass — this is a restyle of components with
existing test coverage, not new logic, so no test behavior should change except where a
test asserts specific CSS classes that this redesign intentionally changes (those get
updated, not weakened). `npm run build` must stay clean. Manual verification in a real
browser (per this project's established practice of testing UI changes live, not just via
unit tests) covering: all 4 tabs render, filters remain functional, ARIA tab
semantics preserved, no regressions in real API data flowing through to the new layout.

## Non-goals

- Period-over-period % change for any KPI card (needs "value N periods ago," not computed
  today).
- Elasticity Coefficient, Route Volatility/Spike Index, Time-Band Distribution, and
  Elasticity Alerts — all require new backend metrics (and in the volume/spike/band cases,
  booking-volume data the system doesn't collect at all). Deferred to a future sub-project
  if pursued.
- A column picker or pagination for the Data Drill-down table.
- The mockups' hover-flyout filter pattern (replaced with a persistent panel, see above).
- Copying any fabricated data from the mockups verbatim (fake carriers, fake city-pairs,
  fake record counts, fake dates) — every number shown must come from the real API.
- Rewriting charts as hand-rolled SVG instead of Recharts.
- Adding `tailwind.config.js` or the Tailwind CDN script — stays on the existing Tailwind
  v4 CSS-native `@theme` setup.
