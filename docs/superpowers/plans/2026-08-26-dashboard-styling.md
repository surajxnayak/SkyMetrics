# Dashboard Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a dark, violet-accented visual design (Tailwind CSS) to every existing dashboard component, without changing any behavior, data flow, or the existing ARIA tab accessibility pattern.

**Architecture:** Tailwind CSS v4 via its official `@tailwindcss/vite` plugin (no separate `tailwind.config.js` or `postcss.config.js` needed — v4's Vite integration auto-detects content and reads design tokens directly from CSS `@theme` custom properties). Each component gets Tailwind `className` additions only; Recharts components additionally get their color props set directly, since Tailwind classes can't reach into SVG chart internals.

**Tech Stack:** Tailwind CSS v4, `@tailwindcss/vite`, Google Fonts (Inter, JetBrains Mono) — added to the existing React 18 + TypeScript + Vite + Recharts dashboard.

---

### Task 1: Tailwind v4 setup + design tokens

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/vite.config.ts`
- Create: `dashboard/src/index.css`
- Modify: `dashboard/src/main.tsx`

- [ ] **Step 1: Install Tailwind v4**

Run (from `dashboard/`):
```bash
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add the Tailwind Vite plugin**

Modify `dashboard/vite.config.ts` — add the import and register the plugin:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
```

- [ ] **Step 3: Create the design tokens + global stylesheet**

Create `dashboard/src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
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

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

body {
  background-color: var(--color-page);
  color: var(--color-primary);
  font-family: var(--font-sans);
}
```

- [ ] **Step 4: Import the stylesheet**

Modify `dashboard/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Verify existing tests still pass and the build succeeds**

Run: `npm test`
Expected: all 33 existing tests PASS (this step adds no new component styling yet, so nothing should break).

Run: `npm run build`
Expected: builds successfully, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/index.css src/main.tsx
git commit -m "feat: Tailwind CSS v4 setup with dark-theme design tokens"
```

---

### Task 2: Style `App.tsx` (shell + tab bar)

**Files:**
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Apply Tailwind classes, preserving every ARIA attribute exactly as-is**

Replace the full contents of `dashboard/src/App.tsx`:

```typescript
import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";

type Tab = "trend" | "heatmap" | "elasticity";

const TABS: { id: Tab; label: string }[] = [
  { id: "trend", label: "Trend" },
  { id: "heatmap", label: "Heatmap" },
  { id: "elasticity", label: "Elasticity" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("trend");

  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-page text-primary">
        <div className="w-72 shrink-0 border-r border-line bg-panel p-6">
          <h1 className="mb-6 text-lg font-semibold tracking-tight">SkyMetrics APIx Dashboard</h1>
          <Sidebar />
          <div className="mt-6 border-t border-line pt-6">
            <DataQualityPanel />
          </div>
        </div>
        <main className="flex-1 p-8">
          <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "border-b-2 border-accent px-4 py-2 text-sm font-medium text-primary"
                    : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary hover:text-primary"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "trend" && <TrendView />}
            {tab === "heatmap" && <SectorHeatmap />}
            {tab === "elasticity" && <LeadTimeElasticity />}
          </div>
        </main>
      </div>
    </FilterProvider>
  );
}
```

Note: the tab list is refactored from three hand-written `<button>` elements into a `TABS.map(...)` loop — a pure structural cleanup that renders identical DOM (same `role`, `aria-selected`, click handlers, text) for each tab, done here because adding per-tab conditional className logic three times inline was more error-prone to keep in sync than mapping once. `role="tab"` and `aria-selected` are unchanged; `App.test.tsx` (which queries by role and text) is unaffected.

- [ ] **Step 2: Run the existing App tests to confirm no regression**

Run: `npm test -- App.test`
Expected: all `App.test.tsx` tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "style: dark theme + tab bar styling for App shell"
```

---

### Task 3: Style `Sidebar.tsx`

**Files:**
- Modify: `dashboard/src/components/Sidebar.tsx`

- [ ] **Step 1: Apply Tailwind classes to every label/input/select**

Replace the full contents of `dashboard/src/components/Sidebar.tsx`:

```typescript
import { useFilters, type Filters } from "../context/FilterContext";

const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"];

const LABEL_CLASS = "mb-1 mt-4 block text-xs font-medium uppercase tracking-wide text-secondary first:mt-0";
const INPUT_CLASS =
  "w-full rounded-md border border-line bg-inset px-3 py-1.5 text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";

export default function Sidebar() {
  const { filters, setFilters } = useFilters();

  return (
    <aside>
      <label htmlFor="frequency" className={LABEL_CLASS}>
        Frequency
      </label>
      <select
        id="frequency"
        value={filters.frequency}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, frequency: e.target.value as Filters["frequency"] }))
        }
        className={INPUT_CLASS}
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>

      <label htmlFor="start-date" className={LABEL_CLASS}>
        Start
      </label>
      <input
        id="start-date"
        value={filters.startDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="end-date" className={LABEL_CLASS}>
        End
      </label>
      <input
        id="end-date"
        value={filters.endDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="origin" className={LABEL_CLASS}>
        Origin
      </label>
      <input
        id="origin"
        value={filters.origin}
        onChange={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="destination" className={LABEL_CLASS}>
        Destination
      </label>
      <input
        id="destination"
        value={filters.destination}
        onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="carrier" className={LABEL_CLASS}>
        Carrier
      </label>
      <input
        id="carrier"
        value={filters.carrier}
        onChange={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="advance-window" className={LABEL_CLASS}>
        Advance window
      </label>
      <select
        id="advance-window"
        value={filters.advanceWindow}
        onChange={(e) => setFilters((prev) => ({ ...prev, advanceWindow: e.target.value }))}
        className={INPUT_CLASS}
      >
        <option value="">All</option>
        {ADVANCE_WINDOWS.map((window) => (
          <option key={window} value={window}>
            {window}
          </option>
        ))}
      </select>

      <label htmlFor="fare-class" className={LABEL_CLASS}>
        Fare class
      </label>
      <input
        id="fare-class"
        value={filters.fareClass}
        onChange={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />
    </aside>
  );
}
```

Every `id`, `value`, `onChange`, `onBlur` is unchanged from the original — only `className` is added, so `Sidebar.test.tsx` (which queries by label/role and fires change/blur events) is unaffected.

- [ ] **Step 2: Run the existing Sidebar tests to confirm no regression**

Run: `npm test -- Sidebar.test`
Expected: all `Sidebar.test.tsx` tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "style: dark theme styling for Sidebar filter controls"
```

---

### Task 4: Style `DataQualityPanel.tsx`

> **Correction found during review:** the code below originally used `text-down`
> for error states. A code-quality reviewer flagged this as a semantic-color
> mismatch — `down` is defined (Task 1) as specifically "price decrease," not a
> generic error color, and reusing it here would set a bad precedent once
> real price-direction UI exists. Fixed by adding a dedicated `--color-error`
> token (Task 1's `@theme` block, same red value, distinct meaning) and using
> `text-error` for all `role="alert"` error states throughout this plan
> (Tasks 4, 5, 6, 7). The code blocks below already reflect this fix.

**Files:**
- Modify: `dashboard/src/components/DataQualityPanel.tsx`

- [ ] **Step 1: Apply Tailwind classes, using font-mono for the numeric stats**

Replace only the `export default function DataQualityPanel()` block at the end of `dashboard/src/components/DataQualityPanel.tsx` (everything above it — `computeStats`, `ADVANCE_WINDOWS`, the `DataQualityStats` interface — is unchanged):

```typescript
export default function DataQualityPanel() {
  const fares = useFares();
  const metadata = useMetadata();

  if (fares.loading || metadata.loading) return <p className="text-sm text-secondary">Loading data quality...</p>;
  if (fares.error) return (
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

  const routes = Object.keys(metadata.data.weights.weights);
  const stats = computeStats(fares.data, routes);

  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-secondary">Data quality</h3>
      <p className="mb-1 text-sm text-primary">
        Coverage: <span className="font-mono text-accent">{stats.coveragePercent.toFixed(0)}%</span>
      </p>
      <p className="mb-1 text-sm text-primary">
        Outliers flagged: <span className="font-mono text-accent">{stats.outlierPercent.toFixed(1)}%</span>
      </p>
      <p className="text-sm text-primary">
        Source health:{" "}
        <span className="font-mono">
          {stats.availableCount} available / {stats.noFlightCount} no-flight
        </span>
      </p>
    </div>
  );
}
```

Note: the two `if (!fares.data || !metadata.data)` checks are split into two separate `if` statements instead of one combined `||` check — purely to keep each returned JSX block on its own line without a long combined condition; behavior is identical (either missing data still returns the same message). All text content, `role="alert"` usage, and conditional logic are otherwise unchanged, so `DataQualityPanel.test.tsx` is unaffected.

- [ ] **Step 2: Run the existing DataQualityPanel tests to confirm no regression**

Run: `npm test -- DataQualityPanel.test`
Expected: all `DataQualityPanel.test.tsx` tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataQualityPanel.tsx
git commit -m "style: dark theme styling for DataQualityPanel with monospace stats"
```

---

### Task 5: Style `TrendView.tsx` (including Recharts theming)

**Files:**
- Modify: `dashboard/src/components/TrendView.tsx`

- [ ] **Step 1: Apply Tailwind classes + Recharts prop-level color theming**

Replace the full contents of `dashboard/src/components/TrendView.tsx`:

```typescript
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useIndexSeries } from "../hooks/useIndexSeries";
import ExportButton from "./ExportButton";

const TOOLTIP_STYLE = { backgroundColor: "#12161f", border: "1px solid #1e2530", borderRadius: 6 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };

export default function TrendView() {
  const { filters } = useFilters();
  const { data, loading, error } = useIndexSeries(filters.frequency, filters.startDate, filters.endDate);

  if (loading) return <p className="text-sm text-secondary">Loading trend data...</p>;
  if (error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load trend data: {error}
    </p>
  );
  if (!data || data.series.length === 0) return <p className="text-sm text-secondary">No index data available yet.</p>;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-primary">Trend view</h2>
      <p className="mb-4 font-mono text-sm text-secondary">Base period: {data.series[0].base_period}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
          <XAxis dataKey="period" stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          <Line type="monotone" dataKey="simple_relative" stroke="#a78bfa" />
          <Line type="monotone" dataKey="laspeyres" stroke="#4ade80" />
          <Line type="monotone" dataKey="paasche" stroke="#f0b429" />
          <Line type="monotone" dataKey="fisher" stroke="#f87171" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={data.series} filename="trend.csv" />
      </div>
    </div>
  );
}
```

The four line colors are distinct (violet accent for the primary `simple_relative` series, green/amber/red for the three weighted formulas) so they stay distinguishable against each other, not just against the dark background. `dataKey`, `type="monotone"`, and every prop unrelated to color/text styling are unchanged, so `TrendView.test.tsx` (which reads chart data via Recharts' rendered DOM structure, per Phase 4b's established jsdom-workaround pattern) is unaffected.

- [ ] **Step 2: Run the existing TrendView tests to confirm no regression**

Run: `npm test -- TrendView.test`
Expected: all `TrendView.test.tsx` tests PASS.

- [ ] **Step 3: Manually verify the chart renders correctly in a real browser**

Run: `npm run dev`, open `http://localhost:5173`, view the Trend tab.
Expected: chart lines are visible and distinguishable against the dark background (jsdom/Vitest can't render real chart pixels — this is a real-browser-only check, per Phase 4b's known jsdom limitation).

- [ ] **Step 4: Commit**

```bash
git add src/components/TrendView.tsx
git commit -m "style: dark theme + Recharts color theming for TrendView"
```

---

### Task 6: Style `SectorHeatmap.tsx`

**Files:**
- Modify: `dashboard/src/components/SectorHeatmap.tsx`

- [ ] **Step 1: Apply Tailwind classes to the table, and restyle `colorFor` for the dark theme**

Modify `dashboard/src/components/SectorHeatmap.tsx`. The `colorFor` function currently produces light pink-to-white cell shading (`rgb(255, intensity, intensity)`), which would be nearly invisible against a dark background — replace it with a violet-intensity scale that stays visible on `bg-inset`, and add Tailwind classes to the table markup:

```typescript
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
}

export function aggregate(records: FareRecord[], drilldown: DrilldownFilters): Cell[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
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
  // Violet intensity scale: low fares stay near the panel background,
  // high fares approach the full accent color -- visible against dark,
  // unlike the original light-pink scale this replaces.
  const lightness = Math.round(20 + ratio * 45);
  return `hsl(258, 60%, ${lightness}%)`;
}

export default function SectorHeatmap() {
  const { filters } = useFilters();
  const { data, loading, error } = useFares({
    origin: filters.origin,
    destination: filters.destination,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading) return <p className="text-sm text-secondary">Loading heatmap data...</p>;
  if (error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load heatmap data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const cells = aggregate(data, {
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
  });
  if (cells.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;

  const routes = Array.from(new Set(cells.map((cell) => cell.route))).sort();
  const periods = Array.from(new Set(cells.map((cell) => cell.period))).sort();
  const values = cells.map((cell) => cell.meanFare);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cellByKey = new Map(cells.map((cell) => [`${cell.route}|${cell.period}`, cell.meanFare]));

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-primary">Sector heatmap</h2>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-line bg-panel px-3 py-2 text-left font-medium text-secondary">Route</th>
            {periods.map((period) => (
              <th key={period} className="border border-line bg-panel px-3 py-2 text-left font-mono font-medium text-secondary">
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route}>
              <th className="border border-line bg-panel px-3 py-2 text-left font-medium text-primary">{route}</th>
              {periods.map((period) => {
                const value = cellByKey.get(`${route}|${period}`);
                return (
                  <td
                    key={period}
                    className="border border-line px-3 py-2 text-right font-mono text-primary"
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
      <div className="mt-4">
        <ExportButton data={cells} filename="heatmap.csv" />
      </div>
    </div>
  );
}
```

`aggregate()` is byte-for-byte unchanged. `colorFor()`'s signature and behavior (a function of `value`/`min`/`max` returning a CSS color string) are unchanged — only the actual color formula changes, which `SectorHeatmap.test.tsx` doesn't assert on directly (it tests `aggregate()`, not cell colors, per the existing test file).

- [ ] **Step 2: Run the existing SectorHeatmap tests to confirm no regression**

Run: `npm test -- SectorHeatmap.test`
Expected: all `SectorHeatmap.test.tsx` tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/SectorHeatmap.tsx
git commit -m "style: dark theme styling for SectorHeatmap, violet intensity scale"
```

---

### Task 7: Style `LeadTimeElasticity.tsx`

**Files:**
- Modify: `dashboard/src/components/LeadTimeElasticity.tsx`

- [ ] **Step 1: Apply Tailwind classes + Recharts color theming**

Replace the full contents of `dashboard/src/components/LeadTimeElasticity.tsx`:

```typescript
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

const WINDOW_ORDER = ["T+45", "T+30", "T+15", "T+7", "T+1"];
const TOOLTIP_STYLE = { backgroundColor: "#12161f", border: "1px solid #1e2530", borderRadius: 6 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type ElasticityPoint = {
  advance_window: string;
  meanFare: number;
};

export interface ElasticityDrilldownFilters {
  carrier: string;
  fareClass: string;
}

export function aggregate(records: FareRecord[], drilldown: ElasticityDrilldownFilters): ElasticityPoint[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.carrier && record.carrier !== drilldown.carrier) continue;
    if (drilldown.fareClass && record.fare_class !== drilldown.fareClass) continue;
    const existing = groups.get(record.advance_window) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(record.advance_window, existing);
  }
  return WINDOW_ORDER.filter((window) => groups.has(window)).map((window) => {
    const { sum, count } = groups.get(window)!;
    return { advance_window: window, meanFare: sum / count };
  });
}

export default function LeadTimeElasticity() {
  const { filters } = useFilters();
  const { data, loading, error } = useFares({
    origin: filters.origin,
    destination: filters.destination,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading) return <p className="text-sm text-secondary">Loading elasticity data...</p>;
  if (error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load elasticity data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregate(data, { carrier: filters.carrier, fareClass: filters.fareClass });
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-primary">Lead-time elasticity</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
          <XAxis dataKey="advance_window" stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          <Line type="monotone" dataKey="meanFare" stroke="#a78bfa" name="Mean fare" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={points} filename="elasticity.csv" />
      </div>
    </div>
  );
}
```

`aggregate()` and `WINDOW_ORDER` are byte-for-byte unchanged. Same reasoning as Task 5 for why `LeadTimeElasticity.test.tsx` is unaffected.

- [ ] **Step 2: Run the existing LeadTimeElasticity tests to confirm no regression**

Run: `npm test -- LeadTimeElasticity.test`
Expected: all `LeadTimeElasticity.test.tsx` tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/LeadTimeElasticity.tsx
git commit -m "style: dark theme + Recharts color theming for LeadTimeElasticity"
```

---

### Task 8: Style `ExportButton.tsx`

**Files:**
- Modify: `dashboard/src/components/ExportButton.tsx`

- [ ] **Step 1: Apply Tailwind classes to the button only**

Modify only the `export default function ExportButton` block in `dashboard/src/components/ExportButton.tsx` (`csvEscape` and `toCsv` are unchanged):

```typescript
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
      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-page hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      Export CSV
    </button>
  );
}
```

`onClick`, `disabled`, and the button's text content are unchanged, so `ExportButton.test.tsx` (which queries by role/text and asserts on the download behavior) is unaffected.

- [ ] **Step 2: Run the existing ExportButton tests to confirm no regression**

Run: `npm test -- ExportButton.test`
Expected: all `ExportButton.test.tsx` tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ExportButton.tsx
git commit -m "style: dark theme styling for ExportButton"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Vitest suite**

Run: `npm test`
Expected: all 33 tests PASS (same count as before this plan started — this plan adds no new tests, per the design spec's Testing section, since pure visual styling isn't behavior to unit-test).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: builds successfully. Specifically check for any Tailwind class that got stripped by the v4 content scanner (would show up as unstyled elements in Step 3, not a build error) — the plan avoided this by using only literal class-name strings, never runtime-constructed ones.

- [ ] **Step 3: Real-browser verification against the real API**

Run the real API (with `DATABASE_URL`/`SKYMETRICS_API_KEYS` set, per the main README) and the dashboard dev server side by side:

```bash
# terminal 1, from repo root
export $(cat .env | xargs)
export SKYMETRICS_API_KEYS=dev-local-key
uvicorn api.main:app --reload

# terminal 2, from dashboard/
npm run dev
```

Open `http://localhost:5173` in a real browser. Expected: dark theme renders correctly across all three tabs (Trend, Heatmap, Elasticity), the sidebar filters are usable, the data-quality panel shows real numbers in monospace, chart lines are distinguishable, the heatmap's violet intensity scale is visible, and the Export CSV button downloads a real file. This is the project's established "verify against real data in a real browser, not just tests" discipline — Vitest/jsdom cannot confirm visual rendering.

- [ ] **Step 4: Run `ruff check` and `pytest` once more to confirm the backend is untouched**

Run (from repo root): `pytest && ruff check .`
Expected: all pass — this plan touches only `dashboard/`, so the Python backend should be completely unaffected, verified rather than assumed.

## Self-review notes

- **Spec coverage:** Tailwind v4 setup + tokens (Task 1), App shell/tab bar (Task 2), Sidebar (Task 3), DataQualityPanel (Task 4), TrendView incl. Recharts theming (Task 5), SectorHeatmap incl. dark-theme-safe color scale (Task 6), LeadTimeElasticity incl. Recharts theming (Task 7), ExportButton (Task 8), full-suite + build + real-browser verification (Task 9) — every design-spec section maps to a task.
- **No placeholders:** every step has complete, literal file contents or precise diffs, exact commands, and stated expected output.
- **Type/signature consistency:** `Cell`, `DrilldownFilters`, `ElasticityPoint`, `ElasticityDrilldownFilters`, `DataQualityStats`, `aggregate()`, `computeStats()`, `colorFor()`, `toCsv()`, `csvEscape()` — every exported type/function signature is preserved exactly as it exists today across all tasks; only `colorFor()`'s internal formula (not its signature) changes, called out explicitly in Task 6.
- **One real correction from the spec:** the spec's Tech Setup section named `tailwind.config.ts`. This plan uses Tailwind v4's actual current setup instead (`@tailwindcss/vite` plugin + CSS `@theme` tokens, no separate config file) — the more current, officially-recommended approach as of Tailwind v4, and simpler than the v3-era config-file pattern the spec assumed. Same design tokens, same visual outcome, more current implementation.
