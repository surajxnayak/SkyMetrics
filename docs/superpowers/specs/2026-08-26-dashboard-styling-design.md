# SkyMetrics Dashboard Styling Design

Date: 2026-08-26
Status: Approved for implementation

## Context

The dashboard (`dashboard/`, Phase 4b: React 18 + TypeScript + Vite + Recharts) shipped fully functional but completely unstyled — no CSS anywhere, raw browser-default HTML. This was a genuine gap in Phase 4b's brainstorming, not a deliberate deferral (see `docs/superpowers/specs/2026-08-25-phase4b-dashboard-design.md`, which never once discusses visual styling). The user deliberately sequenced this work after database setup (see project memory), and asked for "the best designs" — visual quality is a real requirement here, not just "add some CSS."

Design direction was chosen interactively via mockup previews (superpowers visual-companion brainstorming): a **dark analytics/terminal** aesthetic (Bloomberg-terminal-adjacent — dark background, high-contrast data) with a **violet accent** (chosen specifically for its "modern-fintech, Stripe/Linear-adjacent, premium SaaS" quality over a more literal terminal teal or ticker amber).

## Goals

- Style all six existing dashboard features (trend view, sector heatmap, lead-time elasticity, drill-down filtering via the sidebar, CSV export, data-quality panel) plus the tab shell, using Tailwind CSS.
- A defined, WCAG-AA-checked dark color palette and type scale, applied consistently.
- Recharts components (`TrendView`, `LeadTimeElasticity`) themed at the prop level to match the palette (stroke colors, grid, tooltips) — CSS alone can't reach into SVG chart internals.
- Preserve the existing ARIA tablist accessibility pattern in `App.tsx` exactly as-is (ARIA roles/attributes untouched) — only its visual treatment changes.
- All 33 existing Vitest tests continue passing, verified not assumed.

## Non-goals

- No component library (MUI/Chakra/etc.) — the existing hand-built, reviewed, ARIA-correct components stay as React components with Tailwind classes, not replaced by a library's own components. Rejected during brainstorming: real risk of redoing already-shipped accessibility work for no real gain at this dashboard's scale (6-7 components).
- No new backend/API changes — this is purely `dashboard/` frontend work. The dashboard's data flow (REST calls to the Postgres-backed API) is unaffected.
- No light-theme/theme-toggle support in this pass — a single, deliberately-chosen dark theme. A toggle is a distinct, separable feature to consider later if wanted, not bundled in here.
- No redesign of information architecture (tab structure, sidebar filter layout, which chart shows what) — Phase 4b's structural decisions (layout option "B — Sidebar + tabs") stay; this is a visual-styling pass on top of the existing structure.

## Design

### Tech setup

- Add `tailwindcss`, `postcss`, `autoprefixer` to `dashboard/package.json` devDependencies.
- `dashboard/tailwind.config.ts` — `content` scanning `./index.html` and `./src/**/*.{ts,tsx}`; theme extension carries the design tokens below (colors, font families).
- `dashboard/postcss.config.js` — standard Tailwind + Autoprefixer setup.
- `dashboard/src/index.css` (new file, imported once in `main.tsx`) — `@tailwind base; @tailwind components; @tailwind utilities;` plus the Google Fonts `@import` for Inter and JetBrains Mono.
- `dashboard/index.html` — no changes needed beyond what `index.css`'s `@import` already covers (Google Fonts via CSS `@import` avoids needing a `<link>` tag edit, keeping font loading in one place with the rest of the design tokens).

### Design tokens (`tailwind.config.ts` theme extension)

- **Background layers** (dark, layered for depth, not flat black): `bg-page` `#0a0e14`, `bg-panel` `#12161f`, `bg-inset` `#0d1119`, `border-subtle` `#1e2530`.
- **Text**: `text-primary` `#e5e7eb`, `text-secondary` `#9ca3af`, `text-muted` `#6b7280`.
- **Accent (violet)**: `accent-DEFAULT` `#a78bfa`, `accent-hover` `#c4b5fd`, `accent-muted` `#241a3d` (used for subtle backgrounds/tags, matching the mockup's tag treatment).
- **Semantic**: `up` `#4ade80` (price increase — green, standard finance convention), `down` `#f87171` (price decrease — red).
- **Fonts**: `font-sans` → `'Inter', system-ui, sans-serif` (UI text, labels, headings); `font-mono` → `'JetBrains Mono', ui-monospace, monospace` (all numeric data: fares, percentages, index values — the detail validated in the mockup).
- **Contrast check**: `text-primary` (#e5e7eb) on `bg-page`/`bg-panel` exceeds WCAG AA (15.6:1 / 14.6:1, computed during Task 1's code-quality review — a stronger result than this doc originally claimed); `accent-DEFAULT` (#a78bfa) on `bg-panel` computed at ~6.65:1 (this doc originally claimed ~4.6:1 — corrected here after independent verification), comfortably meeting AA for normal text, not just large text/UI components.

### Per-component styling plan

- **`App.tsx`** — tab bar (`role="tablist"`) restyled with Tailwind (active tab: `accent` underline + `text-primary`; inactive: `text-secondary`, hover `text-primary`). ARIA roles/attributes (`role="tab"`, `aria-selected`, `role="tabpanel"`) are not touched, only `className`.
- **`Sidebar.tsx`** — filter inputs/selects get consistent Tailwind form styling (dark inputs, `accent` focus ring, `border-subtle` borders) inside a `bg-panel` container.
- **`SectorHeatmap.tsx`** — the hand-built `<table>` gets Tailwind table styling (`border-subtle` row dividers, `bg-panel` header, hover row highlight in `bg-inset`).
- **`DataQualityPanel.tsx`** — stat cards in `bg-panel` with `font-mono` for the numeric values, matching the mockup's stat treatment (`₹7,388 ▲ 2.4%`-style).
- **`ExportButton.tsx`** — styled as a clear, accent-colored action button (Tailwind classes only, no behavior change).
- **`TrendView.tsx` / `LeadTimeElasticity.tsx`** (Recharts) — `<Line>`/`<CartesianGrid>`/`<Tooltip>` props set directly: line `stroke="#a78bfa"`, grid `stroke="#1e2530"`, tooltip background `bg-panel`-equivalent hex with `text-primary`-equivalent hex (Recharts tooltips render outside Tailwind's DOM reach for some props, so exact hex values are used here rather than Tailwind class names).

### Testing

- Run the existing 33-test Vitest suite after each component's styling pass, not just once at the end — catches a class-name change breaking a role/text/label query immediately, not after the whole dashboard is restyled.
- No new tests are needed for pure visual styling (color/spacing changes aren't behavior to unit-test), but any prop-level Recharts theming change gets a quick manual check in a running dev server (`npm run dev`) since Vitest/jsdom can't render real chart pixels (an already-known limitation from Phase 4b — jsdom masks chart-rendering bugs).
- Final verification: `npm run build` succeeds (Tailwind's content-scanning purge doesn't accidentally strip a class used only in a code path Vitest doesn't exercise), and a real browser check of the running dashboard against the actual API — this project's established "verify against real data, not just tests" discipline.

## Error handling

Not applicable in the traditional sense (this is styling, not new logic) — the one real failure mode is Tailwind's content-purge stripping a dynamically-constructed class name (e.g. a template-string class) that its static scanner can't see. Mitigated by avoiding dynamic class construction — every Tailwind class used is a literal string in the JSX, never built from a variable at runtime.
