# Dashboard Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the approved mockup-derived visual system (new color/type tokens, Material Symbols icons, collapsible nav rail + TopAppBar, restyled charts/tables) into the existing SkyMetrics dashboard, using only data the API already provides.

**Architecture:** Pure restyle of existing, working, tested components — no new API calls, no new derived metrics. `index.css` gains new `@theme` tokens and an icon font. `App.tsx` gets a new navigation shell (collapsible icon rail + TopAppBar) while keeping the existing `role="tablist"`/`"tab"`/`"tabpanel"` ARIA pattern and a persistent (not hover-only) filters panel. Each view component (`TrendView`, `SectorHeatmap`, `LeadTimeElasticity`, `RawListView`, `DataQualityPanel`, `ExportButton`) is restyled individually with the new tokens; `TrendView` additionally gains a small per-route "latest fare" KPI row derived from data it already fetches.

**Tech Stack:** React + TypeScript + Vite, Tailwind CSS v4 (`@theme` in `index.css`, no `tailwind.config.js`), Recharts, Vitest + Testing Library.

---

### Task 1: Design tokens + Material Symbols icon font

**Files:**
- Modify: `dashboard/src/index.css`

- [ ] **Step 1: Add the new tokens and icon font**

Replace the full contents of `dashboard/src/index.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
@import "tailwindcss";

@theme {
  --color-page: #0a0e14;
  --color-panel: #12161f;
  --color-inset: #0d1119;
  --color-line: #1e2530;

  --color-primary: #e5e7eb;
  --color-secondary: #9ca3af;
  --color-muted: #6b7280;

  --color-accent: #a78bfa;
  --color-accent-hover: #c4b5fd;
  --color-accent-muted: #241a3d;

  --color-up: #4ade80;
  --color-down: #f87171;
  --color-error: #f87171;
  --color-warning: #f0b429;

  --color-surface-container: #1c2025;
  --color-surface-container-low: #181c21;
  --color-surface-container-high: #272a30;
  --color-surface-container-highest: #31353b;
  --color-outline-variant: #3c494c;
  --color-on-surface-variant: #bbc9cd;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

body {
  background-color: var(--color-page);
  color: var(--color-primary);
  font-family: var(--font-sans);
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: inherit;
  line-height: 1;
  vertical-align: middle;
}
```

- [ ] **Step 2: Verify the build still succeeds and existing tests are unaffected**

Run:
```bash
cd dashboard && npm run build && npm test -- --run
```
Expected: build succeeds, all 42 existing tests pass (no component uses the new tokens yet, so this is a smoke check that the CSS change alone doesn't break anything).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/index.css
git commit -m "style: add surface-container tokens and Material Symbols icon font"
```

### Task 2: App.tsx navigation restructure

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/__tests__/App.test.tsx`

- [ ] **Step 1: Replace `dashboard/src/App.tsx`**

```tsx
import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";
import RawListView from "./components/RawListView";

type Tab = "trend" | "heatmap" | "elasticity" | "list";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "trend", label: "Trend Analysis", icon: "show_chart" },
  { id: "heatmap", label: "Sector Heatmap", icon: "grid_view" },
  { id: "elasticity", label: "Elasticity", icon: "analytics" },
  { id: "list", label: "Data Drill-down", icon: "database" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("trend");
  const activeLabel = TABS.find((item) => item.id === tab)?.label ?? "";

  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-page text-primary">
        <aside className="group fixed left-0 top-0 z-40 flex h-screen w-14 flex-col overflow-hidden border-r border-outline-variant bg-surface-container transition-[width] duration-200 hover:w-60">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-outline-variant px-4">
            <span className="shrink-0 font-mono text-lg font-bold text-accent">S</span>
            <span className="whitespace-nowrap text-sm font-bold tracking-tight text-accent opacity-0 transition-opacity group-hover:opacity-100">
              SkyMetrics
            </span>
          </div>
          <nav role="tablist" className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "flex items-center gap-3 border-l-2 border-accent bg-surface-container-high px-4 py-2 text-accent"
                    : "flex items-center gap-3 border-l-2 border-transparent px-4 py-2 text-secondary hover:bg-surface-container-highest hover:text-primary"
                }
              >
                <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[20px]">
                  {icon}
                </span>
                <span className="whitespace-nowrap text-sm opacity-0 transition-opacity group-hover:opacity-100">
                  {label}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="ml-14 flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-outline-variant bg-surface-container px-4">
            <h1 className="font-mono text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {activeLabel}
            </h1>
          </header>

          <div className="flex flex-1 gap-4 p-4">
            <div className="w-72 shrink-0 rounded-sm border border-outline-variant bg-panel p-4">
              <Sidebar />
              <div className="mt-6 border-t border-outline-variant pt-6">
                <DataQualityPanel />
              </div>
            </div>
            <main className="flex-1">
              <div role="tabpanel">
                {tab === "trend" && <TrendView />}
                {tab === "heatmap" && <SectorHeatmap />}
                {tab === "elasticity" && <LeadTimeElasticity />}
                {tab === "list" && <RawListView />}
              </div>
            </main>
          </div>
        </div>
      </div>
    </FilterProvider>
  );
}
```

- [ ] **Step 2: Update `dashboard/src/__tests__/App.test.tsx`**

The old sidebar's `<h1>SkyMetrics APIx Dashboard</h1>` is gone (replaced by the rail's "SkyMetrics" wordmark + a TopAppBar showing the active page title), and nav labels are now fuller ("Heatmap" -> "Sector Heatmap", "List" -> "Data Drill-down", "Trend" -> "Trend Analysis" for the ARIA test). Replace the full contents of `dashboard/src/__tests__/App.test.tsx` with:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

vi.mock("../api/client", () => ({
  getIndex: vi.fn().mockResolvedValue({
    comparison_id: "abc",
    frequency: "daily",
    series: [{ period: "2026-08-24", base_period: "2026-08-24", routes: ["DEL-BOM"], simple_relative: 100.0 }],
  }),
  getFares: vi.fn().mockResolvedValue([
    {
      origin: "DEL",
      destination: "BOM",
      carrier: "QP",
      source: "akasaair",
      advance_window: "T+1",
      fare_class: "U1",
      total_fare: 7000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T10:00:00+00:00",
    },
  ]),
  getFareRecords: vi.fn().mockResolvedValue({
    mean_total_fare: 7000,
    records: [
      {
        quote_id: "q1",
        collected_at: "2026-08-24T10:00:00+00:00",
        travel_date: "2026-09-01",
        route: "DEL-BOM",
        source: "akasaair",
        carrier: "QP",
        advance_window: "T+1",
        fare_class: "U1",
        routing: null,
        status: "available",
        is_outlier: false,
        total_fare: 7000,
        delta_from_mean: 0,
      },
    ],
  }),
  getMetadata: vi.fn().mockResolvedValue({
    weights: {
      source: "test",
      period: "2025",
      computed_at: "2026-08-24",
      weights: { "DEL-BOM": 1 },
    },
    formulas: {},
    snapshots: [],
  }),
}));

describe("App", () => {
  it("renders the dashboard title and defaults to the trend tab", async () => {
    render(<App />);

    expect(screen.getByText("SkyMetrics")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());
  });

  it("switches to the heatmap tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Sector Heatmap"));

    await waitFor(() => expect(screen.getByText("Sector heatmap")).toBeInTheDocument());
  });

  it("switches to the elasticity tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Elasticity"));

    await waitFor(() => expect(screen.getByText("Lead-time elasticity")).toBeInTheDocument());
  });

  it("switches to the list tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Data Drill-down"));

    await waitFor(() => expect(screen.getByText("List view")).toBeInTheDocument());
  });

  it("uses the correct ARIA tab pattern", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const trendTab = screen.getByRole("tab", { name: "Trend Analysis" });
    const heatmapTab = screen.getByRole("tab", { name: "Sector Heatmap" });
    expect(trendTab).toHaveAttribute("aria-selected", "true");
    expect(heatmapTab).toHaveAttribute("aria-selected", "false");

    await userEvent.click(heatmapTab);

    expect(trendTab).toHaveAttribute("aria-selected", "false");
    expect(heatmapTab).toHaveAttribute("aria-selected", "true");
  });
});
```

- [ ] **Step 3: Run the test and confirm it passes**

Run: `cd dashboard && npm test -- --run src/__tests__/App.test.tsx`
Expected: 5/5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/App.tsx dashboard/src/__tests__/App.test.tsx
git commit -m "style: replace App.tsx sidebar+tabs with collapsible icon rail + TopAppBar"
```

### Task 3: ExportButton icon

**Files:**
- Modify: `dashboard/src/components/ExportButton.tsx`

- [ ] **Step 1: Add the icon**

Replace the full contents of `dashboard/src/components/ExportButton.tsx` with:

```tsx
interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
}

function csvEscape(value: unknown): string {
  const str = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = Array.from(headerSet);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return lines.join("\n");
}

export default function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
}: ExportButtonProps<T>) {
  function handleClick() {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <button
      onClick={handleClick}
      disabled={data.length === 0}
      className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-page hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent/40 disabled:text-secondary"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
        download
      </span>
      <span>Export CSV</span>
    </button>
  );
}
```

Note: the icon span has `aria-hidden="true"` (excluded from the button's accessible name) and the label is in its own `<span>Export CSV</span>` (so its own text content is exactly `"Export CSV"`, distinct from the button's combined text) — this means `getByText("Export CSV")` still resolves uniquely everywhere it's already used (`ExportButton.test.tsx`, `TrendView.test.tsx`, `LeadTimeElasticity.test.tsx`), and `toBeDisabled()` still works because jest-dom's disabled check walks up the parent chain to the `<button>`. No test files need changes for this task.

- [ ] **Step 2: Run the existing tests to confirm nothing broke**

Run: `cd dashboard && npm test -- --run src/__tests__/ExportButton.test.tsx`
Expected: 4/4 tests pass, unmodified.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/ExportButton.tsx
git commit -m "style: add download icon to ExportButton"
```

### Task 4: DataQualityPanel restyle

**Files:**
- Modify: `dashboard/src/components/DataQualityPanel.tsx`

- [ ] **Step 1: Restyle to a bordered stat block**

Replace the full contents of `dashboard/src/components/DataQualityPanel.tsx` with:

```tsx
import { useFares } from "../hooks/useFares";
import { useMetadata } from "../hooks/useMetadata";
import type { FareRecord } from "../api/types";
import { useFilters } from "../context/FilterContext";
import { ADVANCE_WINDOWS } from "../config/filters";

export interface DataQualityStats {
  coveragePercent: number;
  outlierPercent: number;
  availableCount: number;
  noFlightCount: number;
}

export function computeStats(records: FareRecord[], routes: string[]): DataQualityStats {
  const expected = new Set<string>();
  for (const route of routes) {
    for (const window of ADVANCE_WINDOWS) {
      expected.add(`${route}|${window}`);
    }
  }

  const seen = new Set<string>();
  let outlierCount = 0;
  let availableCount = 0;
  let noFlightCount = 0;
  for (const record of records) {
    const route = `${record.origin}-${record.destination}`;
    seen.add(`${route}|${record.advance_window}`);
    if (record.is_outlier) outlierCount += 1;
    if (record.status === "available") availableCount += 1;
    if (record.status === "no_flight") noFlightCount += 1;
  }

  let coveredCount = 0;
  for (const key of expected) {
    if (seen.has(key)) coveredCount += 1;
  }

  return {
    coveragePercent: expected.size === 0 ? 0 : (coveredCount / expected.size) * 100,
    outlierPercent: records.length === 0 ? 0 : (outlierCount / records.length) * 100,
    availableCount,
    noFlightCount,
  };
}

export default function DataQualityPanel() {
  const { appliedFilters: filters } = useFilters();
  const fares = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });
  const metadata = useMetadata();

  if ((fares.loading && !fares.data) || metadata.loading) {
    return <p className="text-sm text-secondary">Loading data quality...</p>;
  }
  if (fares.error && !fares.data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load data quality: {fares.error}
    </p>
  );
  if (metadata.error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load data quality: {metadata.error}
    </p>
  );
  if (!metadata.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;
  if (!fares.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;

  const routes = filters.selectedRoutes.length > 0
    ? filters.selectedRoutes
    : Object.keys(metadata.data.weights.weights);
  const stats = computeStats(fares.data, routes);

  return (
    <div>
      <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
        Data quality
      </h3>
      {fares.error && (
        <p role="alert" className="mb-2 text-sm text-error">
          Search failed: {fares.error}
        </p>
      )}
      <div className="flex flex-col gap-1.5 rounded-sm border border-outline-variant bg-surface-container-low p-3">
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Coverage:</span>
          <span className="font-mono text-accent">{stats.coveragePercent.toFixed(0)}%</span>
        </p>
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Outliers flagged:</span>
          <span className="font-mono text-accent">{stats.outlierPercent.toFixed(1)}%</span>
        </p>
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Source health:</span>
          <span className="font-mono">
            {stats.availableCount} available / {stats.noFlightCount} no-flight
          </span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing tests to confirm nothing broke**

Run: `cd dashboard && npm test -- --run src/__tests__/DataQualityPanel.test.tsx`
Expected: 4/4 tests pass, unmodified (the regex `/Coverage:/` still matches the inner `<span>Coverage:</span>`).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/DataQualityPanel.tsx
git commit -m "style: restyle DataQualityPanel as a bordered stat block"
```

### Task 5: TrendView restyle + per-route KPI row

**Files:**
- Modify: `dashboard/src/components/TrendView.tsx`
- Modify: `dashboard/src/__tests__/TrendView.test.tsx`

- [ ] **Step 1: Replace `dashboard/src/components/TrendView.tsx`**

```tsx
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FareRecord } from "../api/types";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";

const TOOLTIP_STYLE = { backgroundColor: "#1c2025", border: "1px solid #3c494c", borderRadius: 4 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };
// Numeric values (Y-axis ticks, tooltip line values) get the mono font, per
// the design spec's "all numeric data" rule -- text labels (X-axis periods,
// legend series names) stay in the default sans font.
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO_FONT };
const CHART_COLORS = ["#a78bfa", "#4ade80", "#f0b429", "#f87171"];

export type TrendPoint = {
  period: string;
  route: string;
  meanFare: number;
};

export type TrendChartPoint = Record<string, string | number>;

function isoWeekOf(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodOf(value: string, frequency: string): string {
  const date = new Date(value);
  if (frequency === "weekly") return isoWeekOf(date);
  if (frequency === "monthly") return value.slice(0, 7);
  return value.slice(0, 10);
}

export function aggregateTrend(records: FareRecord[], frequency: string): TrendPoint[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    const route = `${record.origin}-${record.destination}`;
    const period = periodOf(record.collected_at, frequency);
    const key = `${period}|${route}`;
    const existing = groups.get(key) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.entries())
    .map(([key, { sum, count }]) => {
      const [period, route] = key.split("|");
      return { period, route, meanFare: sum / count };
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.route.localeCompare(b.route));
}

export function pivotTrend(points: TrendPoint[], routes: string[]): TrendChartPoint[] {
  const rows = new Map<string, TrendChartPoint>();
  for (const point of points) {
    const row = rows.get(point.period) ?? { period: point.period };
    row[point.route] = point.meanFare;
    rows.set(point.period, row);
  }
  return Array.from(rows.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

function formatFare(value: unknown): string {
  if (typeof value !== "number") return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function TrendView() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <p className="text-sm text-secondary">Loading trend data...</p>;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load trend data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregateTrend(data, filters.frequency);
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;
  const routes = filters.selectedRoutes.filter((route) => points.some((point) => point.route === route));
  const chartData = pivotTrend(points, routes);
  const latestRow = chartData[chartData.length - 1];

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-1 text-base font-semibold text-primary">Trend view</h2>
      <p className="mb-4 font-mono text-sm text-on-surface-variant">Routes: {routes.join(", ")}</p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {routes.map((route) => (
          <div key={route} className="rounded-sm border border-outline-variant bg-panel p-2">
            <p className="font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">{route}</p>
            <p className="font-mono text-lg font-semibold text-primary">{formatFare(latestRow?.[route])}</p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3c494c" />
          <XAxis dataKey="period" stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12 }} />
          <YAxis stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12, fontFamily: MONO_FONT }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          <Legend wrapperStyle={{ color: "#bbc9cd", fontSize: 12 }} />
          {routes.map((route, index) => (
            <Line
              key={route}
              type="monotone"
              dataKey={route}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              name={route}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={points} filename="trend.csv" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the test for the new KPI row**

The new per-route KPI row renders each route's code (e.g. `"DEL-BOM"`) a second time (in addition to Recharts' `<Legend>`), so `getByText("DEL-BOM")` now matches two elements instead of one. In `dashboard/src/__tests__/TrendView.test.tsx`, replace the `"plots one mean fare trend line per route"` test with:

```tsx
  it("plots one mean fare trend line per route", async () => {
    const { container } = render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());

    expect(screen.getAllByText("DEL-BOM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEL-BLR").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });
```

(Only this one test changes -- `"shows selected routes once data loads"` and `"renders an export button once data loads"` are unaffected and stay exactly as they are.)

- [ ] **Step 3: Run the test and confirm it passes**

Run: `cd dashboard && npm test -- --run src/__tests__/TrendView.test.tsx`
Expected: 3/3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/TrendView.tsx dashboard/src/__tests__/TrendView.test.tsx
git commit -m "style: restyle TrendView, add per-route latest-fare KPI row"
```

### Task 6: SectorHeatmap restyle

**Files:**
- Modify: `dashboard/src/components/SectorHeatmap.tsx`

- [ ] **Step 1: Replace `dashboard/src/components/SectorHeatmap.tsx`**

```tsx
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type Cell = {
  route: string;
  period: string;
  meanFare: number;
};

export interface DrilldownFilters {
  carrier: string;
  advanceWindow: string;
  fareClass: string;
  sources: string[];
}

export function aggregate(records: FareRecord[], drilldown: DrilldownFilters): Cell[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.sources.length > 0 && !drilldown.sources.includes(record.source)) continue;
    if (drilldown.carrier && record.carrier !== drilldown.carrier) continue;
    if (drilldown.advanceWindow && record.advance_window !== drilldown.advanceWindow) continue;
    if (drilldown.fareClass && record.fare_class !== drilldown.fareClass) continue;
    const route = `${record.origin}-${record.destination}`;
    const period = record.collected_at.slice(0, 10);
    const key = `${route}|${period}`;
    const existing = groups.get(key) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([key, { sum, count }]) => {
    const [route, period] = key.split("|");
    return { route, period, meanFare: sum / count };
  });
}

function colorFor(value: number, min: number, max: number): string {
  if (max === min) return "#241a3d";
  const ratio = (value - min) / (max - min);
  // Violet intensity scale, lightness 28%-48%: high enough above the page
  // background (#0a0e14) to stay visually distinct from empty/no-data
  // cells, low enough that text-primary (#e5e7eb) rendered on top still
  // meets WCAG AA (4.5:1) even at the brightest (highest-fare) end --
  // verified via code-quality review after the original 20%-65% range
  // failed both checks.
  const lightness = Math.round(28 + ratio * 20);
  return `hsl(258, 60%, ${lightness}%)`;
}

export default function SectorHeatmap() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <p className="text-sm text-secondary">Loading heatmap data...</p>;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load heatmap data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const cells = aggregate(data, {
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    sources: filters.sources,
  });
  if (cells.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;

  const routes = Array.from(new Set(cells.map((cell) => cell.route))).sort();
  const periods = Array.from(new Set(cells.map((cell) => cell.period))).sort();
  const values = cells.map((cell) => cell.meanFare);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cellByKey = new Map(cells.map((cell) => [`${cell.route}|${cell.period}`, cell.meanFare]));

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-4 text-base font-semibold text-primary">Sector heatmap</h2>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-outline-variant bg-panel px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">
                Route
              </th>
              {periods.map((period) => (
                <th
                  key={period}
                  className="border border-outline-variant bg-panel px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-on-surface-variant"
                >
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route}>
                <th className="border border-outline-variant bg-panel px-3 py-2 text-left font-medium text-primary">
                  {route}
                </th>
                {periods.map((period) => {
                  const value = cellByKey.get(`${route}|${period}`);
                  return (
                    <td
                      key={period}
                      className="border border-outline-variant px-3 py-2 text-right font-mono text-primary"
                      style={{ backgroundColor: value !== undefined ? colorFor(value, min, max) : undefined }}
                    >
                      {value !== undefined ? Math.round(value) : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <ExportButton data={cells} filename="heatmap.csv" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing tests to confirm nothing broke**

Run: `cd dashboard && npm test -- --run src/__tests__/SectorHeatmap.test.tsx`
Expected: 2/2 tests pass, unmodified.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/SectorHeatmap.tsx
git commit -m "style: restyle SectorHeatmap borders and typography"
```

### Task 7: LeadTimeElasticity restyle

**Files:**
- Modify: `dashboard/src/components/LeadTimeElasticity.tsx`

- [ ] **Step 1: Replace `dashboard/src/components/LeadTimeElasticity.tsx`**

```tsx
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

const WINDOW_ORDER = ["T+45", "T+30", "T+15", "T+7", "T+1"];
const TOOLTIP_STYLE = { backgroundColor: "#1c2025", border: "1px solid #3c494c", borderRadius: 4 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };
// Numeric values (Y-axis ticks, tooltip line values) get the mono font, per
// the design spec's "all numeric data" rule -- text labels (X-axis windows,
// legend series names) stay in the default sans font.
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO_FONT };
const CHART_COLORS = ["#a78bfa", "#4ade80", "#f0b429", "#f87171"];

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type ElasticityPoint = {
  advance_window: string;
  route: string;
  meanFare: number;
};

export type ElasticityChartPoint = Record<string, string | number>;

export interface ElasticityDrilldownFilters {
  carrier: string;
  fareClass: string;
  sources: string[];
}

export function aggregate(records: FareRecord[], drilldown: ElasticityDrilldownFilters): ElasticityPoint[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.sources.length > 0 && !drilldown.sources.includes(record.source)) continue;
    if (drilldown.carrier && record.carrier !== drilldown.carrier) continue;
    if (drilldown.fareClass && record.fare_class !== drilldown.fareClass) continue;
    const route = `${record.origin}-${record.destination}`;
    const key = `${record.advance_window}|${route}`;
    const existing = groups.get(key) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(key, existing);
  }
  const points = Array.from(groups.entries()).map(([key, { sum, count }]) => {
    const [advance_window, route] = key.split("|");
    return { advance_window, route, meanFare: sum / count };
  });
  return points.sort(
    (a, b) =>
      WINDOW_ORDER.indexOf(a.advance_window) - WINDOW_ORDER.indexOf(b.advance_window) ||
      a.route.localeCompare(b.route)
  );
}

export function pivotElasticity(points: ElasticityPoint[]): ElasticityChartPoint[] {
  const rows = new Map<string, ElasticityChartPoint>();
  for (const point of points) {
    const row = rows.get(point.advance_window) ?? { advance_window: point.advance_window };
    row[point.route] = point.meanFare;
    rows.set(point.advance_window, row);
  }
  return WINDOW_ORDER.filter((window) => rows.has(window)).map((window) => rows.get(window)!);
}

export default function LeadTimeElasticity() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <p className="text-sm text-secondary">Loading elasticity data...</p>;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load elasticity data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregate(data, {
    carrier: filters.carrier,
    fareClass: filters.fareClass,
    sources: filters.sources,
  });
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;
  const routes = filters.selectedRoutes.filter((route) => points.some((point) => point.route === route));
  const chartData = pivotElasticity(points);

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-4 text-base font-semibold text-primary">Lead-time elasticity</h2>
      <p className="mb-4 font-mono text-sm text-on-surface-variant">Routes: {routes.join(", ")}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3c494c" />
          <XAxis dataKey="advance_window" stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12 }} />
          <YAxis stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12, fontFamily: MONO_FONT }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          <Legend wrapperStyle={{ color: "#bbc9cd", fontSize: 12 }} />
          {routes.map((route, index) => (
            <Line
              key={route}
              type="monotone"
              dataKey={route}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              name={route}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={points} filename="elasticity.csv" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing tests to confirm nothing broke**

Run: `cd dashboard && npm test -- --run src/__tests__/LeadTimeElasticity.test.tsx`
Expected: 4/4 tests pass, unmodified.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/LeadTimeElasticity.tsx
git commit -m "style: restyle LeadTimeElasticity borders and typography"
```

### Task 8: RawListView restyle

**Files:**
- Modify: `dashboard/src/components/RawListView.tsx`

- [ ] **Step 1: Replace `dashboard/src/components/RawListView.tsx`**

```tsx
import { useFilters } from "../context/FilterContext";
import { useFareRecords } from "../hooks/useFareRecords";
import ExportButton from "./ExportButton";

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDelta(value: number | null): string {
  if (value === null) return "-";
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(rounded))}`;
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

export default function RawListView() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFareRecords({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <p className="text-sm text-secondary">Loading fare records...</p>;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load fare records: {error}
    </p>
  );
  if (!data || data.records.length === 0) {
    return <p className="text-sm text-secondary">No fare records available yet.</p>;
  }

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-primary">List view</h2>
          <p className="font-mono text-sm text-on-surface-variant">
            Mean fare: {formatCurrency(data.mean_total_fare)} / Records: {data.records.length}
          </p>
        </div>
        <ExportButton data={data.records} filename="fare-records.csv" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                "Collected",
                "Travel",
                "Route",
                "Source",
                "Carrier",
                "Window",
                "Class",
                "Routing",
                "Status",
                "Price",
                "Vs mean",
              ].map((heading) => (
                <th
                  key={heading}
                  className="border border-outline-variant bg-panel px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-on-surface-variant"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.records.map((record) => (
              <tr key={record.quote_id} className="odd:bg-surface-container-low even:bg-panel">
                <td className="border border-outline-variant px-3 py-2 font-mono text-primary">
                  {formatDateTime(record.collected_at)}
                </td>
                <td className="border border-outline-variant px-3 py-2 font-mono text-primary">
                  {record.travel_date}
                </td>
                <td className="border border-outline-variant px-3 py-2 text-primary">{record.route}</td>
                <td className="border border-outline-variant px-3 py-2 text-primary">{record.source}</td>
                <td className="border border-outline-variant px-3 py-2 font-mono text-primary">
                  {record.carrier}
                </td>
                <td className="border border-outline-variant px-3 py-2 font-mono text-primary">
                  {record.advance_window}
                </td>
                <td className="border border-outline-variant px-3 py-2 font-mono text-primary">
                  {record.fare_class ?? "-"}
                </td>
                <td className="border border-outline-variant px-3 py-2 text-primary">{record.routing ?? "-"}</td>
                <td className="border border-outline-variant px-3 py-2 text-primary">
                  {record.is_outlier ? `${record.status} / outlier` : record.status}
                </td>
                <td className="border border-outline-variant px-3 py-2 text-right font-mono text-primary">
                  {formatCurrency(record.total_fare)}
                </td>
                <td className="border border-outline-variant px-3 py-2 text-right font-mono text-primary">
                  {formatDelta(record.delta_from_mean)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing tests to confirm nothing broke**

Run: `cd dashboard && npm test -- --run src/__tests__/RawListView.test.tsx`
Expected: 1/1 tests pass, unmodified.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/RawListView.tsx
git commit -m "style: restyle RawListView table borders and typography"
```

### Task 9: Final verification

**Files:**
- Read only (no changes)

- [ ] **Step 1: Run the full dashboard test suite**

Run: `cd dashboard && npm test -- --run`
Expected: all test files pass (43 tests: the original 42, with one of them -- TrendView's route-line test -- updated in Task 5 to use `getAllByText`, not removed).

- [ ] **Step 2: Run the production build**

Run: `cd dashboard && npm run build`
Expected: builds cleanly, no TypeScript or Tailwind errors.

- [ ] **Step 3: Manual browser verification**

Start both servers from the repo root and check the running app, per this project's established practice of testing UI changes live, not just via unit tests:

```bash
set -a && source .env && set +a && export SKYMETRICS_API_KEYS=dev-local-key && uvicorn api.main:app --reload --port 8000 &
cd dashboard && npm run dev
```

Open `http://localhost:5173` and confirm:
- The icon rail is 56px collapsed, expands to show labels on hover, and the 4 page icons/labels are all present.
- Clicking each rail item switches the visible page and updates the TopAppBar title.
- The filters panel (routes, sources, carrier, advance window, fare class, frequency, time range) is visible without needing to hover anything, and "Search" still applies filters correctly.
- Data Quality stats show real numbers.
- Trend view shows the new per-route KPI cards with real latest-fare values, and the chart still renders lines.
- Sector Heatmap, Elasticity, and Data Drill-down all render real data with the new borders/typography.
- No console errors.

- [ ] **Step 4: Report result**

If all of the above pass, this plan is complete. If manual verification finds a visual issue, fix it in the relevant component's file and re-run that component's test file before re-verifying in the browser.
