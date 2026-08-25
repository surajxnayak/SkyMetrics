# Phase 4b: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React + TypeScript dashboard (PRD §4.4, F-4.1 through F-4.6) consuming the existing Phase 4a API.

**Architecture:** A new `dashboard/` Vite + React + TypeScript app. A sidebar (persistent filter state via React context) + three tabs (Trend, Heatmap, Elasticity), each a thin component over a fetch hook. No new backend endpoints except a CORS policy on the already-shipped `api/main.py`. See `docs/superpowers/specs/2026-08-25-phase4b-dashboard-design.md` for full rationale.

**Tech Stack:** React 18, TypeScript, Vite, Recharts, Vitest + React Testing Library (all free/OSS). Python side: FastAPI's `CORSMiddleware` (already a transitive dependency of `fastapi`, no new package).

---

### Task 1: Frontend project scaffolding

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/tsconfig.node.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/index.html`
- Create: `dashboard/.env.example`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/App.tsx`
- Test: `dashboard/src/__tests__/App.test.tsx`

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "skymetrics-dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Correction found during code-quality review:** `"vite/client"` is required in `types` — without it, `import.meta.env.VITE_API_BASE_URL`/`VITE_API_KEY` (used by Task 3's `client.ts`) fails `tsc -b` with `TS2339: Property 'env' does not exist on type 'ImportMeta'`. This wasn't caught by Task 1's own smoke test (which never reads `import.meta.env`) but would have broken Task 3 immediately.

- [ ] **Step 3: Create `dashboard/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `dashboard/vite.config.ts`**

**Correction found during code-quality review:** importing `defineConfig` from plain `"vite"` fails `tsc -b`/`npm run build` with `TS2769` — Vite's own `defineConfig` doesn't carry Vitest's `test`-field type augmentation. Import from `"vitest/config"` instead (a re-export of the same function with that augmentation merged in).

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
```

- [ ] **Step 5: Create `dashboard/src/setupTests.ts`**

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Create `dashboard/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>SkyMetrics APIx Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `dashboard/.env.example`**

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=dev-local-key
```

- [ ] **Step 8: Create `dashboard/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div>
      <h1>SkyMetrics APIx Dashboard</h1>
    </div>
  );
}
```

- [ ] **Step 9: Create `dashboard/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 10: Write the failing smoke test**

```tsx
// dashboard/src/__tests__/App.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("renders the dashboard title", () => {
    render(<App />);
    expect(screen.getByText("SkyMetrics APIx Dashboard")).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Install dependencies and run the test**

Run:
```bash
cd dashboard
npm install
npm test
```
Expected: 1 test passed (this also proves the whole toolchain — Vite, TypeScript, Vitest, React Testing Library — is wired correctly before any real feature work starts).

- [ ] **Step 12: Confirm the dev server starts**

Run: `npm run dev` (from `dashboard/`), then Ctrl-C to stop it once you see the "Local: http://localhost:5173/" line.
Expected: starts with no errors.

- [ ] **Step 13: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/
git commit -m "chore: scaffold dashboard (Vite + React + TypeScript + Vitest)"
```

**Additional corrections found during code-quality review, all committed as follow-ups:** the root `.gitignore` also needed `*.tsbuildinfo`, `dashboard/vite.config.js`, and `dashboard/vite.config.d.ts` — `npm run build` generates these directly under `dashboard/`, and none were covered by the original `node_modules/`/`dist/` lines. (An attempted fix of adding `"noEmit": true` to `dashboard/tsconfig.node.json` was tried and reverted: TypeScript hard-errors — `TS6310: Referenced project '...' may not disable emit` — when a config reached via another config's `"references"` array sets `noEmit`; the `.gitignore` additions close the same gap without hitting that error.) Separately, `.github/workflows/ci.yml` gained an independent `dashboard` job (`actions/setup-node@v4`, `npm ci && npm run build && npm test`, no `needs:` coupling to the existing Python job) — added now, at the start of this sub-phase, rather than discovered after all 11 tasks had stacked up on an unverified toolchain (as happened reactively with Phase 4a's own CI gap).

---

### Task 2: Backend CORS policy

**Files:**
- Modify: `api/main.py`
- Test: `tests/test_api_main.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_api_main.py` (alongside the existing tests in that file):

```python
def test_cors_preflight_from_configured_origin_succeeds():
    response = client.options(
        "/api/v1/metadata",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-API-Key",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_preflight_from_other_origin_is_not_allowed():
    response = client.options(
        "/api/v1/metadata",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-API-Key",
        },
    )

    assert "access-control-allow-origin" not in response.headers
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_api_main.py -k cors -v`
Expected: FAIL — no CORS headers are present at all yet, so both assertions on the first test fail (status code will still be a 4xx/error since no `OPTIONS` route exists without the middleware).

- [ ] **Step 3: Add the CORS middleware to `api/main.py`**

Add this import alongside the existing `fastapi` imports near the top of the file:

```python
from fastapi.middleware.cors import CORSMiddleware
```

Add this immediately after `app = FastAPI(title="SkyMetrics APIx API", version="1.0.0")`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["X-API-Key"],
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_api_main.py -k cors -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -q`
Expected: PASS (131 tests: 129 existing + 2 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add api/main.py tests/test_api_main.py
git commit -m "feat: add CORS policy for the dashboard's origin"
```

---

### Task 3: API client and types

**Files:**
- Create: `dashboard/src/api/types.ts`
- Create: `dashboard/src/api/client.ts`
- Test: `dashboard/src/__tests__/client.test.ts`

- [ ] **Step 1: Create `dashboard/src/api/types.ts`**

```typescript
export type Frequency = "daily" | "weekly" | "monthly";

export interface IndexPoint {
  period: string;
  base_period: string;
  routes: string[];
  simple_relative: number;
  laspeyres?: number;
  paasche?: number;
  fisher?: number;
}

export interface IndexResponse {
  comparison_id: string;
  frequency: Frequency;
  series: IndexPoint[];
}

export interface FareRecord {
  origin: string;
  destination: string;
  carrier: string;
  advance_window: string;
  fare_class: string | null;
  total_fare: number | null;
  status: string;
  is_outlier: boolean;
  collected_at: string;
}

export interface WeightsMetadata {
  source: string;
  period: string;
  computed_at: string;
  weights: Record<string, number>;
}

export interface SnapshotSummary {
  comparison_id: string;
  frequency: Frequency;
  written_at: string;
}

export interface MetadataResponse {
  weights: WeightsMetadata;
  formulas: Record<string, string>;
  snapshots: SnapshotSummary[];
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// dashboard/src/__tests__/client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getFares, getIndex, getMetadata } from "../api/client";

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getIndex", () => {
  it("calls /api/v1/index with the frequency query param and the API key header", async () => {
    mockFetchOnce({ comparison_id: "abc", frequency: "daily", series: [] });

    await getIndex({ frequency: "daily" });

    const [url, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/v1/index");
    expect(url).toContain("frequency=daily");
    expect((options.headers as Record<string, string>)["X-API-Key"]).toBeDefined();
  });

  it("omits comparison_id, start, and end from the URL when they're not provided", async () => {
    mockFetchOnce({ comparison_id: "abc", frequency: "daily", series: [] });

    await getIndex({ frequency: "daily" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).not.toContain("comparison_id");
    expect(url).not.toContain("start");
    expect(url).not.toContain("end");
    expect(url).not.toContain("undefined");
  });

  it("returns the parsed JSON body", async () => {
    mockFetchOnce({ comparison_id: "abc", frequency: "daily", series: [] });

    const result = await getIndex({ frequency: "daily" });

    expect(result.comparison_id).toBe("abc");
  });
});

describe("getFares", () => {
  it("omits undefined filters from the query string", async () => {
    mockFetchOnce([]);

    await getFares({ origin: "DEL" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("origin=DEL");
    expect(url).not.toContain("destination");
  });
});

describe("getMetadata", () => {
  it("throws an ApiError when the response is not ok", async () => {
    mockFetchOnce({ detail: "invalid or missing API key" }, 401);

    await expect(getMetadata()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/client.test.ts`
Expected: FAIL with `Error: Failed to resolve import "../api/client"`

- [ ] **Step 4: Create `dashboard/src/api/client.ts`**

```typescript
import type { FareRecord, IndexResponse, MetadataResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  const queryString = query.toString();
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!response.ok) {
    throw new ApiError(response.status, `${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getIndex(params: {
  frequency: string;
  comparisonId?: string;
  start?: string;
  end?: string;
}): Promise<IndexResponse> {
  return get<IndexResponse>("/api/v1/index", {
    frequency: params.frequency,
    comparison_id: params.comparisonId,
    start: params.start,
    end: params.end,
  });
}

export function getFares(
  params: { origin?: string; destination?: string; start?: string; end?: string } = {}
): Promise<FareRecord[]> {
  return get<FareRecord[]>("/api/v1/fares", params);
}

export function getMetadata(): Promise<MetadataResponse> {
  return get<MetadataResponse>("/api/v1/metadata");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/client.test.ts`
Expected: PASS (5 tests)

**Correction found during code-quality review:** `FareRecord.fare_class` in Step 1's `types.ts` must be `string | null`, not `string` — real backend records with `status: "no_flight"` have `fare_class: null` (matching `total_fare`'s already-correct nullability), and the design spec's data-quality panel treats these records as first-class data. Also, the "omits undefined filters" test originally only covered `getFares`, which doesn't actually exercise the guard (its unset params are absent object keys, not present-with-`undefined` ones) — the `getIndex` test above (already folded into Step 2) was added to close that gap, since `getIndex` always builds an object with `comparison_id`/`start`/`end` present as `undefined` when the caller omits them, making the guard genuinely load-bearing there.

- [ ] **Step 6: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (6 tests: 1 from Task 1 + 5 new)

- [ ] **Step 7: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/api/
git commit -m "feat: API client and response types"
```

---

### Task 4: Filter context and sidebar

**Files:**
- Create: `dashboard/src/context/FilterContext.tsx`
- Create: `dashboard/src/components/Sidebar.tsx`
- Test: `dashboard/src/__tests__/FilterContext.test.tsx`
- Test: `dashboard/src/__tests__/Sidebar.test.tsx`

The five advance-purchase windows are fixed and known (matching `ADVANCE_WINDOWS` in `scraper/schema.py`), so the sidebar offers them as a dropdown. Carrier, origin, destination, and fare class have no fixed enumerable set the frontend knows in advance, so those are plain text inputs — consistent with the API's own query params, which take arbitrary strings.

- [ ] **Step 1: Write the failing `FilterContext` tests**

```tsx
// dashboard/src/__tests__/FilterContext.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterProvider, useFilters } from "../context/FilterContext";

function Probe() {
  const { filters, setFilters } = useFilters();
  return (
    <div>
      <span data-testid="frequency">{filters.frequency}</span>
      <button onClick={() => setFilters({ ...filters, origin: "DEL" })}>set origin</button>
      <span data-testid="origin">{filters.origin}</span>
    </div>
  );
}

describe("FilterContext", () => {
  it("provides sensible defaults", () => {
    render(
      <FilterProvider>
        <Probe />
      </FilterProvider>
    );

    expect(screen.getByTestId("frequency").textContent).toBe("daily");
    expect(screen.getByTestId("origin").textContent).toBe("");
  });

  it("lets a consumer update filters", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <FilterProvider>
        <Probe />
      </FilterProvider>
    );

    await userEvent.click(screen.getByText("set origin"));

    expect(screen.getByTestId("origin").textContent).toBe("DEL");
  });
});
```

Add `@testing-library/user-event` to `dashboard/package.json`'s `devDependencies`: `"@testing-library/user-event": "^14.5.2"`. Run `npm install` in `dashboard/` after adding it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npm install && npx vitest run src/__tests__/FilterContext.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../context/FilterContext"`

- [ ] **Step 3: Create `dashboard/src/context/FilterContext.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Frequency } from "../api/types";

export interface Filters {
  frequency: Frequency;
  startDate: string;
  endDate: string;
  origin: string;
  destination: string;
  carrier: string;
  advanceWindow: string;
  fareClass: string;
}

export const DEFAULT_FILTERS: Filters = {
  frequency: "daily",
  startDate: "",
  endDate: "",
  origin: "",
  destination: "",
  carrier: "",
  advanceWindow: "",
  fareClass: "",
};

interface FilterContextValue {
  filters: Filters;
  setFilters: (filters: Filters) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  return <FilterContext.Provider value={{ filters, setFilters }}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/FilterContext.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing `Sidebar` test**

```tsx
// dashboard/src/__tests__/Sidebar.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterProvider, useFilters } from "../context/FilterContext";
import Sidebar from "../components/Sidebar";

function OriginProbe() {
  const { filters } = useFilters();
  return <span data-testid="origin-value">{filters.origin}</span>;
}

describe("Sidebar", () => {
  it("updates the shared filter state when the origin input changes", async () => {
    render(
      <FilterProvider>
        <Sidebar />
        <OriginProbe />
      </FilterProvider>
    );

    await userEvent.type(screen.getByLabelText("Origin"), "DEL");

    expect(screen.getByTestId("origin-value").textContent).toBe("DEL");
  });

  it("offers the five fixed advance-window options", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    const select = screen.getByLabelText("Advance window") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["", "T+1", "T+7", "T+15", "T+30", "T+45"]);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/Sidebar.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../components/Sidebar"`

- [ ] **Step 7: Create `dashboard/src/components/Sidebar.tsx`**

```tsx
import { useFilters } from "../context/FilterContext";

const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"];

export default function Sidebar() {
  const { filters, setFilters } = useFilters();

  return (
    <aside>
      <label htmlFor="frequency">Frequency</label>
      <select
        id="frequency"
        value={filters.frequency}
        onChange={(e) => setFilters({ ...filters, frequency: e.target.value as Filters["frequency"] })}
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>

      <label htmlFor="start-date">Start</label>
      <input
        id="start-date"
        value={filters.startDate}
        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
      />

      <label htmlFor="end-date">End</label>
      <input
        id="end-date"
        value={filters.endDate}
        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
      />

      <label htmlFor="origin">Origin</label>
      <input
        id="origin"
        value={filters.origin}
        onChange={(e) => setFilters({ ...filters, origin: e.target.value.toUpperCase() })}
      />

      <label htmlFor="destination">Destination</label>
      <input
        id="destination"
        value={filters.destination}
        onChange={(e) => setFilters({ ...filters, destination: e.target.value.toUpperCase() })}
      />

      <label htmlFor="carrier">Carrier</label>
      <input
        id="carrier"
        value={filters.carrier}
        onChange={(e) => setFilters({ ...filters, carrier: e.target.value.toUpperCase() })}
      />

      <label htmlFor="advance-window">Advance window</label>
      <select
        id="advance-window"
        value={filters.advanceWindow}
        onChange={(e) => setFilters({ ...filters, advanceWindow: e.target.value })}
      >
        <option value="">All</option>
        {ADVANCE_WINDOWS.map((window) => (
          <option key={window} value={window}>
            {window}
          </option>
        ))}
      </select>

      <label htmlFor="fare-class">Fare class</label>
      <input
        id="fare-class"
        value={filters.fareClass}
        onChange={(e) => setFilters({ ...filters, fareClass: e.target.value.toUpperCase() })}
      />
    </aside>
  );
}
```

This references `Filters["frequency"]` as a type — add the import for it: change the top import line to:

```tsx
import { useFilters, type Filters } from "../context/FilterContext";
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/Sidebar.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (10 tests: 6 from Task 3 + 4 new)

- [ ] **Step 10: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/context/ dashboard/src/components/Sidebar.tsx dashboard/src/__tests__/FilterContext.test.tsx dashboard/src/__tests__/Sidebar.test.tsx dashboard/package.json dashboard/package-lock.json
git commit -m "feat: shared filter state and sidebar controls"
```

---

### Task 5: Export button (built before the views that use it)

**Files:**
- Create: `dashboard/src/components/ExportButton.tsx`
- Test: `dashboard/src/__tests__/ExportButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// dashboard/src/__tests__/ExportButton.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportButton from "../components/ExportButton";

describe("ExportButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is disabled when there is no data", () => {
    render(<ExportButton data={[]} filename="empty.csv" />);
    expect(screen.getByText("Export CSV")).toBeDisabled();
  });

  it("builds a CSV blob and triggers a download when clicked", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportButton data={[{ a: 1, b: 2 }]} filename="test.csv" />);
    await userEvent.click(screen.getByText("Export CSV"));

    expect(createObjectURL).toHaveBeenCalled();
    const [blob] = createObjectURL.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/ExportButton.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../components/ExportButton"`

- [ ] **Step 3: Create `dashboard/src/components/ExportButton.tsx`**

```tsx
interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
}

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? "")).join(","));
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
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={handleClick} disabled={data.length === 0}>
      Export CSV
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/ExportButton.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (12 tests: 10 from Task 4 + 2 new)

- [ ] **Step 6: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/components/ExportButton.tsx dashboard/src/__tests__/ExportButton.test.tsx
git commit -m "feat: generic CSV export button"
```

---

### Task 6: Trend view (F-4.1)

**Files:**
- Create: `dashboard/src/hooks/useIndexSeries.ts`
- Create: `dashboard/src/components/TrendView.tsx`
- Test: `dashboard/src/__tests__/TrendView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// dashboard/src/__tests__/TrendView.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import TrendView from "../components/TrendView";

vi.mock("../api/client", () => ({
  getIndex: vi.fn().mockResolvedValue({
    comparison_id: "abc123",
    frequency: "daily",
    series: [
      { period: "2026-08-24", base_period: "2026-08-24", routes: ["DEL-BOM"], simple_relative: 100.0 },
      {
        period: "2026-08-25",
        base_period: "2026-08-24",
        routes: ["DEL-BOM"],
        simple_relative: 106.7,
        laspeyres: 106.9,
        paasche: 106.7,
        fisher: 106.8,
      },
    ],
  }),
}));

describe("TrendView", () => {
  it("shows the base period once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    expect(screen.getByText("Loading trend data...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Base period: 2026-08-24/)).toBeInTheDocument());
  });

  it("renders an export button once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/TrendView.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../components/TrendView"`

- [ ] **Step 3: Create `dashboard/src/hooks/useIndexSeries.ts`**

```typescript
import { useEffect, useState } from "react";
import { getIndex } from "../api/client";
import type { IndexResponse } from "../api/types";

interface UseIndexSeriesResult {
  data: IndexResponse | null;
  loading: boolean;
  error: string | null;
}

export function useIndexSeries(frequency: string, start: string, end: string): UseIndexSeriesResult {
  const [data, setData] = useState<IndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getIndex({ frequency, start: start || undefined, end: end || undefined })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [frequency, start, end]);

  return { data, loading, error };
}
```

- [ ] **Step 4: Create `dashboard/src/components/TrendView.tsx`**

```tsx
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useIndexSeries } from "../hooks/useIndexSeries";
import ExportButton from "./ExportButton";

export default function TrendView() {
  const { filters } = useFilters();
  const { data, loading, error } = useIndexSeries(filters.frequency, filters.startDate, filters.endDate);

  if (loading) return <p>Loading trend data...</p>;
  if (error) return <p role="alert">Failed to load trend data: {error}</p>;
  if (!data || data.series.length === 0) return <p>No index data available yet.</p>;

  return (
    <div>
      <h2>Trend view</h2>
      <p>Base period: {data.series[0].base_period}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="simple_relative" stroke="#8884d8" />
          <Line type="monotone" dataKey="laspeyres" stroke="#82ca9d" />
          <Line type="monotone" dataKey="paasche" stroke="#ffc658" />
          <Line type="monotone" dataKey="fisher" stroke="#ff7300" />
        </LineChart>
      </ResponsiveContainer>
      <ExportButton data={data.series} filename="trend.csv" />
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/TrendView.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (14 tests: 12 from Task 5 + 2 new)

- [ ] **Step 7: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/hooks/useIndexSeries.ts dashboard/src/components/TrendView.tsx dashboard/src/__tests__/TrendView.test.tsx
git commit -m "feat: trend view (F-4.1)"
```

---

### Task 7: Fares hook and sector heatmap (F-4.2)

**Files:**
- Create: `dashboard/src/hooks/useFares.ts`
- Create: `dashboard/src/components/SectorHeatmap.tsx`
- Test: `dashboard/src/__tests__/SectorHeatmap.test.tsx`

Period grouping for the heatmap uses the calendar date portion of `collected_at` (not the sidebar's frequency selector) — the heatmap's job is a route-by-route intensity grid, not another frequency-aware series, and every prior phase's own aggregation (`index/aggregate.py`) already established date-string grouping as the simplest correct approach. Records with `status != "available"` or `is_outlier: true` are excluded before averaging, matching `index/aggregate.py`'s `representative_prices` convention.

- [ ] **Step 1: Write the failing test**

```tsx
// dashboard/src/__tests__/SectorHeatmap.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import SectorHeatmap from "../components/SectorHeatmap";

vi.mock("../api/client", () => ({
  getFares: vi.fn().mockResolvedValue([
    {
      origin: "DEL",
      destination: "BOM",
      carrier: "QP",
      advance_window: "T+1",
      fare_class: "U1",
      total_fare: 7000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T10:00:00+00:00",
    },
    {
      origin: "DEL",
      destination: "BOM",
      carrier: "QP",
      advance_window: "T+7",
      fare_class: "T3",
      total_fare: 9000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T11:00:00+00:00",
    },
    {
      origin: "DEL",
      destination: "BOM",
      carrier: "QP",
      advance_window: "T+1",
      fare_class: "U1",
      total_fare: 999999,
      status: "available",
      is_outlier: true,
      collected_at: "2026-08-24T12:00:00+00:00",
    },
  ]),
}));

describe("SectorHeatmap", () => {
  it("renders a route row with the mean fare for the period, excluding outliers", async () => {
    render(
      <FilterProvider>
        <SectorHeatmap />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("DEL-BOM")).toBeInTheDocument());
    expect(screen.getByText("8000")).toBeInTheDocument();
  });
});

describe("aggregate", () => {
  it("excludes records that don't match the given carrier, advance window, or fare class", async () => {
    const { aggregate } = await import("../components/SectorHeatmap");
    const records = [
      {
        origin: "DEL",
        destination: "BOM",
        carrier: "QP",
        advance_window: "T+1",
        fare_class: "U1",
        total_fare: 7000,
        status: "available",
        is_outlier: false,
        collected_at: "2026-08-24T10:00:00+00:00",
      },
      {
        origin: "DEL",
        destination: "BOM",
        carrier: "6E",
        advance_window: "T+1",
        fare_class: "U1",
        total_fare: 5000,
        status: "available",
        is_outlier: false,
        collected_at: "2026-08-24T10:00:00+00:00",
      },
    ];

    const cells = aggregate(records, { carrier: "QP", advanceWindow: "", fareClass: "" });

    expect(cells).toHaveLength(1);
    expect(cells[0].meanFare).toBe(7000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/SectorHeatmap.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../components/SectorHeatmap"`

- [ ] **Step 3: Create `dashboard/src/hooks/useFares.ts`**

```typescript
import { useEffect, useState } from "react";
import { getFares } from "../api/client";
import type { FareRecord } from "../api/types";

interface UseFaresResult {
  data: FareRecord[] | null;
  loading: boolean;
  error: string | null;
}

export function useFares(
  params: { origin?: string; destination?: string; start?: string; end?: string } = {}
): UseFaresResult {
  const [data, setData] = useState<FareRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { origin, destination, start, end } = params;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFares({
      origin: origin || undefined,
      destination: destination || undefined,
      start: start || undefined,
      end: end || undefined,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, destination, start, end]);

  return { data, loading, error };
}
```

- [ ] **Step 4: Create `dashboard/src/components/SectorHeatmap.tsx`**

```tsx
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

export interface Cell {
  route: string;
  period: string;
  meanFare: number;
}

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
  if (max === min) return "rgb(200,200,255)";
  const ratio = (value - min) / (max - min);
  const intensity = Math.round(255 - ratio * 155);
  return `rgb(255,${intensity},${intensity})`;
}

export default function SectorHeatmap() {
  const { filters } = useFilters();
  const { data, loading, error } = useFares({
    origin: filters.origin,
    destination: filters.destination,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading) return <p>Loading heatmap data...</p>;
  if (error) return <p role="alert">Failed to load heatmap data: {error}</p>;
  if (!data || data.length === 0) return <p>No fare data available yet.</p>;

  const cells = aggregate(data, {
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
  });
  if (cells.length === 0) return <p>No non-outlier fare data available yet.</p>;

  const routes = Array.from(new Set(cells.map((cell) => cell.route))).sort();
  const periods = Array.from(new Set(cells.map((cell) => cell.period))).sort();
  const values = cells.map((cell) => cell.meanFare);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cellByKey = new Map(cells.map((cell) => [`${cell.route}|${cell.period}`, cell.meanFare]));

  return (
    <div>
      <h2>Sector heatmap</h2>
      <table>
        <thead>
          <tr>
            <th>Route</th>
            {periods.map((period) => (
              <th key={period}>{period}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route}>
              <th>{route}</th>
              {periods.map((period) => {
                const value = cellByKey.get(`${route}|${period}`);
                return (
                  <td
                    key={period}
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
      <ExportButton data={cells} filename="heatmap.csv" />
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/SectorHeatmap.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (16 tests: 14 from Task 6 + 2 new)

- [ ] **Step 7: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/hooks/useFares.ts dashboard/src/components/SectorHeatmap.tsx dashboard/src/__tests__/SectorHeatmap.test.tsx
git commit -m "feat: sector heatmap (F-4.2)"
```

---

### Task 8: Lead-time elasticity (F-4.3)

**Files:**
- Create: `dashboard/src/components/LeadTimeElasticity.tsx`
- Test: `dashboard/src/__tests__/LeadTimeElasticity.test.tsx`

The aggregation function is exported alongside the component (not just used internally) so its ordering and averaging logic can be unit-tested directly, rather than only inferred from Recharts' rendered SVG output.

- [ ] **Step 1: Write the failing test**

```tsx
// dashboard/src/__tests__/LeadTimeElasticity.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import LeadTimeElasticity, { aggregate } from "../components/LeadTimeElasticity";

const RECORDS = [
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    advance_window: "T+1",
    fare_class: "U1",
    total_fare: 9000,
    status: "available",
    is_outlier: false,
    collected_at: "2026-08-24T10:00:00+00:00",
  },
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    advance_window: "T+45",
    fare_class: "U1",
    total_fare: 5000,
    status: "available",
    is_outlier: false,
    collected_at: "2026-08-24T10:00:00+00:00",
  },
];

vi.mock("../api/client", () => ({
  getFares: vi.fn().mockResolvedValue(RECORDS),
}));

const NO_DRILLDOWN = { carrier: "", fareClass: "" };

describe("aggregate", () => {
  it("orders points from farthest to nearest advance window", () => {
    const points = aggregate(RECORDS, NO_DRILLDOWN);

    expect(points.map((p) => p.advance_window)).toEqual(["T+45", "T+1"]);
    expect(points[0].meanFare).toBe(5000);
    expect(points[1].meanFare).toBe(9000);
  });

  it("excludes records that don't match the given carrier or fare class", () => {
    const points = aggregate(RECORDS, { carrier: "6E", fareClass: "" });

    expect(points).toHaveLength(0);
  });
});

describe("LeadTimeElasticity", () => {
  it("renders an export button once data loads", async () => {
    render(
      <FilterProvider>
        <LeadTimeElasticity />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/LeadTimeElasticity.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../components/LeadTimeElasticity"`

- [ ] **Step 3: Create `dashboard/src/components/LeadTimeElasticity.tsx`**

```tsx
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

const WINDOW_ORDER = ["T+45", "T+30", "T+15", "T+7", "T+1"];

export interface ElasticityPoint {
  advance_window: string;
  meanFare: number;
}

export interface DrilldownFilters {
  carrier: string;
  fareClass: string;
}

export function aggregate(records: FareRecord[], drilldown: DrilldownFilters): ElasticityPoint[] {
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

  if (loading) return <p>Loading elasticity data...</p>;
  if (error) return <p role="alert">Failed to load elasticity data: {error}</p>;
  if (!data || data.length === 0) return <p>No fare data available yet.</p>;

  const points = aggregate(data, { carrier: filters.carrier, fareClass: filters.fareClass });
  if (points.length === 0) return <p>No non-outlier fare data available yet.</p>;

  return (
    <div>
      <h2>Lead-time elasticity</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="advance_window" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="meanFare" stroke="#8884d8" name="Mean fare" />
        </LineChart>
      </ResponsiveContainer>
      <ExportButton data={points} filename="elasticity.csv" />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/LeadTimeElasticity.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (19 tests: 16 from Task 7 + 3 new)

- [ ] **Step 6: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/components/LeadTimeElasticity.tsx dashboard/src/__tests__/LeadTimeElasticity.test.tsx
git commit -m "feat: lead-time elasticity view (F-4.3)"
```

---

### Task 9: Metadata hook and data-quality panel (F-4.6)

**Files:**
- Create: `dashboard/src/hooks/useMetadata.ts`
- Create: `dashboard/src/components/DataQualityPanel.tsx`
- Test: `dashboard/src/__tests__/DataQualityPanel.test.tsx`

`computeStats` is exported alongside the component, same reasoning as Task 8's `aggregate` — a genuinely discriminating unit test needs to inspect the numbers directly, not infer them from rendered text. This panel deliberately calls `useFares()` with no filter params (unfiltered by the sidebar's drill-down) so it always reflects overall data health, per the design spec.

- [ ] **Step 1: Write the failing test**

```tsx
// dashboard/src/__tests__/DataQualityPanel.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DataQualityPanel, { computeStats } from "../components/DataQualityPanel";

const RECORDS = [
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    advance_window: "T+1",
    fare_class: "U1",
    total_fare: 7000,
    status: "available",
    is_outlier: false,
    collected_at: "2026-08-24T10:00:00+00:00",
  },
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    advance_window: "T+1",
    fare_class: "U1",
    total_fare: 999999,
    status: "available",
    is_outlier: true,
    collected_at: "2026-08-24T11:00:00+00:00",
  },
  {
    origin: "DEL",
    destination: "BLR",
    carrier: "QP",
    advance_window: "T+7",
    fare_class: "U1",
    total_fare: null,
    status: "no_flight",
    is_outlier: false,
    collected_at: "2026-08-24T12:00:00+00:00",
  },
];

describe("computeStats", () => {
  it("computes coverage against the expected route x window combinations", () => {
    const stats = computeStats(RECORDS, ["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

    expect(stats.coveragePercent).toBeCloseTo((2 / 15) * 100, 5);
  });

  it("computes the outlier rate", () => {
    const stats = computeStats(RECORDS, ["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

    expect(stats.outlierPercent).toBeCloseTo((1 / 3) * 100, 5);
  });

  it("counts available vs no-flight records for source health", () => {
    const stats = computeStats(RECORDS, ["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

    expect(stats.availableCount).toBe(2);
    expect(stats.noFlightCount).toBe(1);
  });
});

vi.mock("../api/client", () => ({
  getFares: vi.fn().mockResolvedValue(RECORDS),
  getMetadata: vi.fn().mockResolvedValue({
    weights: {
      source: "test",
      period: "2025",
      computed_at: "2026-08-24",
      weights: { "DEL-BOM": 0.5, "DEL-BLR": 0.3, "BOM-BLR": 0.2 },
    },
    formulas: {},
    snapshots: [],
  }),
}));

describe("DataQualityPanel", () => {
  it("renders the computed coverage once data loads", async () => {
    render(<DataQualityPanel />);

    await waitFor(() => expect(screen.getByText(/Coverage:/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/DataQualityPanel.test.tsx`
Expected: FAIL with `Error: Failed to resolve import "../components/DataQualityPanel"`

- [ ] **Step 3: Create `dashboard/src/hooks/useMetadata.ts`**

```typescript
import { useEffect, useState } from "react";
import { getMetadata } from "../api/client";
import type { MetadataResponse } from "../api/types";

interface UseMetadataResult {
  data: MetadataResponse | null;
  loading: boolean;
  error: string | null;
}

export function useMetadata(): UseMetadataResult {
  const [data, setData] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMetadata()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
```

- [ ] **Step 4: Create `dashboard/src/components/DataQualityPanel.tsx`**

```tsx
import { useFares } from "../hooks/useFares";
import { useMetadata } from "../hooks/useMetadata";
import type { FareRecord } from "../api/types";

const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"];

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
  const fares = useFares();
  const metadata = useMetadata();

  if (fares.loading || metadata.loading) return <p>Loading data quality...</p>;
  if (fares.error) return <p role="alert">Failed to load data quality: {fares.error}</p>;
  if (metadata.error) return <p role="alert">Failed to load data quality: {metadata.error}</p>;
  if (!fares.data || !metadata.data) return <p>No data quality information available yet.</p>;

  const routes = Object.keys(metadata.data.weights.weights);
  const stats = computeStats(fares.data, routes);

  return (
    <div>
      <h3>Data quality</h3>
      <p>Coverage: {stats.coveragePercent.toFixed(0)}%</p>
      <p>Outliers flagged: {stats.outlierPercent.toFixed(1)}%</p>
      <p>
        Source health: {stats.availableCount} available / {stats.noFlightCount} no-flight
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/DataQualityPanel.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full frontend suite**

Run: `cd dashboard && npm test`
Expected: PASS (23 tests: 19 from Task 8 + 4 new)

- [ ] **Step 7: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/hooks/useMetadata.ts dashboard/src/components/DataQualityPanel.tsx dashboard/src/__tests__/DataQualityPanel.test.tsx
git commit -m "feat: data-quality panel (F-4.6)"
```

---

### Task 10: Wire the app shell (sidebar + tabs)

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/__tests__/App.test.tsx`

Task 1's `App.tsx` was a placeholder that only rendered a title. This task replaces it with the real sidebar+tabs shell (F-4.4's drill-down filters live in the sidebar, applying to every tab via `FilterProvider`). Task 1's smoke test never mocked `../api/client` because the placeholder made no network calls; the real `App` does (via its child components), so this task's test replaces that placeholder test with one that mocks the API — otherwise the test would attempt a real network call against `http://127.0.0.1:8000` during `npm test`, which is exactly the kind of flakiness every other component test in this plan already avoids.

- [ ] **Step 1: Replace the failing test**

```tsx
// dashboard/src/__tests__/App.test.tsx
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
      advance_window: "T+1",
      fare_class: "U1",
      total_fare: 7000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T10:00:00+00:00",
    },
  ]),
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

    expect(screen.getByText("SkyMetrics APIx Dashboard")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());
  });

  it("switches to the heatmap tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Heatmap"));

    await waitFor(() => expect(screen.getByText("Sector heatmap")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/__tests__/App.test.tsx`
Expected: FAIL — `screen.getByText("Trend view")` not found, since `App.tsx` is still the Task 1 placeholder with no tabs.

- [ ] **Step 3: Replace `dashboard/src/App.tsx`**

```tsx
import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";

type Tab = "trend" | "heatmap" | "elasticity";

export default function App() {
  const [tab, setTab] = useState<Tab>("trend");

  return (
    <FilterProvider>
      <div style={{ display: "flex" }}>
        <div>
          <h1>SkyMetrics APIx Dashboard</h1>
          <Sidebar />
          <DataQualityPanel />
        </div>
        <main>
          <nav>
            <button onClick={() => setTab("trend")} aria-pressed={tab === "trend"}>
              Trend
            </button>
            <button onClick={() => setTab("heatmap")} aria-pressed={tab === "heatmap"}>
              Heatmap
            </button>
            <button onClick={() => setTab("elasticity")} aria-pressed={tab === "elasticity"}>
              Elasticity
            </button>
          </nav>
          {tab === "trend" && <TrendView />}
          {tab === "heatmap" && <SectorHeatmap />}
          {tab === "elasticity" && <LeadTimeElasticity />}
        </main>
      </div>
    </FilterProvider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/__tests__/App.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full frontend suite and build**

Run: `cd dashboard && npm test`
Expected: PASS (24 tests)

Note on the count: this task replaces Task 1's 1-test `App.test.tsx` with a 2-test version — a net +1 over the running total, not +2. Expected total: 24 tests (23 from Task 9, +2 new in this file, -1 removed placeholder test).

Run: `cd dashboard && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/surajnayak/Developer/SkyMetrics
git add dashboard/src/App.tsx dashboard/src/__tests__/App.test.tsx
git commit -m "feat: wire sidebar, tabs, and views into the app shell"
```

---

### Task 11: Documentation and real-browser verification

**Files:**
- Modify: `README.md`

This task adds no new source files — its purpose is to document how to run the dashboard and to demonstrate all six features against the real Phase 1-3 data already on disk, in an actual browser, not just component tests with mocked data. Same discipline as Phase 3's Task 6 and Phase 4a's Task 6.

- [ ] **Step 1: Add a "Running the dashboard" section to `README.md`**

Insert after the existing "Running the API" section:

```markdown
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
```

- [ ] **Step 2: Start both servers against the real data already on disk**

```bash
export SKYMETRICS_API_KEYS=dev-local-key
uvicorn api.main:app &
cd dashboard
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env
echo "VITE_API_KEY=dev-local-key" >> .env
npm run dev &
sleep 2
```
Expected: both start with no errors.

- [ ] **Step 3: Verify all six features in a real browser against real data**

Use the browser automation tools available in this environment (or a manual browser check if unavailable) to navigate to `http://localhost:5173` and confirm, against the real data already on disk from Phases 1-3:

- The sidebar renders all filter controls (frequency, dates, origin, destination, carrier, advance window, fare class) and the data-quality panel shows real, non-zero coverage/outlier/source-health numbers (F-4.4, F-4.6).
- The Trend tab (default) shows a real chart with the actual base period from `data/index/*.json` (F-4.1).
- Clicking "Heatmap" shows a real route × date grid with real mean fares (F-4.2).
- Clicking "Elasticity" shows a real curve across whatever advance windows exist in the real cleaned data (F-4.3).
- Typing `DEL` into Origin and `BOM` into Destination actually narrows what the Trend/Heatmap/Elasticity tabs show (F-4.4).
- Clicking "Export CSV" on any tab triggers a real file download with the currently-displayed data.

Report the real numbers/counts seen — don't round them into looking more meaningful than the data supports. If any of these steps reveals a bug, fix it as a new, separate commit (with a test) and re-run this task's steps from the top.

- [ ] **Step 4: Stop both servers**

```bash
kill %1 %2
```

- [ ] **Step 5: Commit the README change**

```bash
git add README.md
git commit -m "docs: document running the Phase 4b dashboard"
```

---

## Definition of done

- `cd dashboard && npm test` passes with 24 tests, and `pytest -q` (repo root) passes with 131 tests — none of them making a live network call (every dashboard test mocks `../api/client`; the CORS test in Task 2 uses FastAPI's in-process `TestClient`, not a real server).
- `cd dashboard && npm run build` succeeds with no TypeScript errors.
- `ruff check .` passes clean.
- The dashboard, run locally against the real Phase 1-3 data already on disk, demonstrates all six PRD features (F-4.1 through F-4.6) in a real browser.
- `README.md` documents how to run both the API and the dashboard together.
