# SkyMetrics Phase 3 — Index Construction (APIx) Design

Date: 2026-08-24
Status: Approved for implementation

## Context

Phases 1-2 (shipped) produce `data/cleaned/<run_id>.jsonl` — de-duplicated, outlier-flagged fare quotes across 3 routes, 5 advance-purchase windows, multiple fare classes and itinerary types per date. Phase 3 (PRD §4.3) turns this into the actual Real-time Airfare Price Index (APIx).

Two hard constraints, discovered while scoping, that shape everything below:

1. **An index needs a base period plus at least one comparison period.** We have 3 raw runs, all from today (2026-08-24). There is no "yesterday's price" yet. This isn't the 30-day back-test gap the PRD already anticipates (§9) — it's more basic: a single day of data cannot produce a real index value at all, only a trivial `100` (the base compared to itself). Real, meaningful index movement can only appear once the now-live daily cron (`daily-scrape.yml`) accumulates multiple real days. Akasa's search API returns only forward-looking fares, so there is no way to backfill historical prices to shortcut this.
2. **Route weights need to come from real DGCA data, not placeholders.** Found and verified: `Vonter/india-aviation-traffic` (ODbL-licensed, open/free) republishes DGCA's own Monthly Statistics (Domestic Air Transport) page as structured CSV, city-pair-wise, through May 2026. Pulled full-year 2025 passenger traffic (both directions) for our 3 routes:

   | Route | 2025 annual passengers (both directions) | Weight |
   |---|---|---|
   | DEL-BOM | 6,527,548 | 0.4331 |
   | DEL-BLR | 4,613,046 | 0.3061 |
   | BOM-BLR | 3,930,625 | 0.2608 |

   These match the PRD's own qualitative ranking (DEL-BOM as "highest domestic traffic corridor," §3.1). Committed as `config/weights.json` with source attribution — not re-fetched at runtime, since DGCA's own publication cadence is monthly/annual, not something to hit on every index run.

## Goals

- Implement all four formulas the PRD names (F-3.2): simple price relative, Laspeyres, Paasche, Fisher.
- Compute a representative price per (route, period) from cleaned data, excluding flagged outliers — this is the decision Phase 2 deliberately deferred ("flag, don't delete... Phase 3's decision, not Phase 2's").
- Support daily/weekly/monthly aggregation (F-3.3) — real, tested logic, honestly documented as trivial until enough real days exist.
- Version every index computation with a revision trail (F-3.5) — never overwrite, always write a new snapshot.
- Build the back-test comparison utility (F-3.6: MAPE, correlation) now, functioning and tested, explicitly not claiming a real 30-day validation yet.

## Non-goals

- No dashboard or API (Phase 4).
- No live weight updates — DGCA's own data doesn't update fast enough to justify runtime fetching; revisit when a newer annual dataset is published.
- No attempt to backfill historical fares — not possible with Akasa's API (forward-looking search only).
- No claim of a validated 30-day back-test — the module works, the data to feed it doesn't exist yet.

## Representative price per (route, period)

```
representative_price(route, period) = mean(total_fare for r in cleaned_records
    if (r.origin, r.destination) == route
    and r.status == "available"
    and r.is_outlier is False
    and period_of(r.collected_at) == period)
```

Averages across **every** advance-purchase window, fare class, and itinerary type (nonstop and connecting alike) collected for that route within the period — consistent with this session's earlier decision to keep every itinerary type ("just like how the real world operates") rather than filtering to nonstop-only. `is_outlier=True` records are excluded here — this is the actual point of Phase 2 flagging rather than deleting them.

`period_of(collected_at)`: `date.isoformat()` for daily, `f"{iso_year}-W{iso_week:02d}"` (via `date.isocalendar()`) for weekly, `"YYYY-MM"` for monthly.

## Formulas

Given `w_i` = route `i`'s DGCA weight, `p_i(0)` = base-period representative price, `p_i(t)` = period-`t` representative price:

- **Simple relative** (equal-weighted, ignores DGCA weights entirely): `I(t) = 100 * mean(p_i(t) / p_i(0) for i in routes)` — the weighted **arithmetic** mean of price relatives.
- **Laspeyres** (fixed base-period weights): `L(t) = 100 * sum(w_i * p_i(t) / p_i(0)) / sum(w_i)` — weighted **arithmetic** mean of relatives, base-period weights.
- **Paasche** (current-period weights): `P(t) = 100 * sum(w_i(t)) / sum(w_i(t) * p_i(0) / p_i(t))` — weighted **harmonic** mean of relatives, current-period weights. This is not a stylistic choice: it is the standard index-number-theory result (Laspeyres = arithmetic mean of relatives with base weights; Paasche = harmonic mean of relatives with current weights — see any CPI methodology manual). An earlier draft of this spec, and the first implementation attempt, used the arithmetic-mean formula for Paasche too (i.e. made it identical in form to Laspeyres) — caught and corrected during Task 2's code review, before it shipped.
- **Fisher** (geometric mean of Laspeyres and Paasche): `F(t) = sqrt(L(t) * P(t))`

**Corrected limitation, stated plainly:** the arithmetic mean is always ≥ the harmonic mean of the same values, with equality only when every price relative is identical. So Laspeyres and Paasche will only numerically coincide in that degenerate case (all routes moved by the same percentage) — **not** simply because we currently have one static weight source. Verified on real numbers: with relatives 1.10, 1.00, 1.10 and the same weights fed to both formulas, Laspeyres = 106.939 and Paasche = 106.733 — genuinely different, even with identical weight inputs. (An earlier version of this document claimed they'd coincide whenever the weight source is the same — that claim was itself downstream of the arithmetic-mean Paasche bug above, and is wrong; corrected here.) What *does* still hold: without a second, differently-dated weight snapshot, Paasche's `w_i(t)` is numerically identical to Laspeyres' `w_i(0)` — but that no longer collapses the two formulas to the same output, because they're different kinds of mean over the same relatives.

## Base period selection

Refined while formalizing the exact code: the unit of comparison is the **period** (from `aggregate.period_of`), not a pair of named run files. `index/build.py`'s core function (`build_series`) takes *all* cleaned records available (however many runs they came from), buckets them into periods via `representative_prices`, and treats the **earliest period present in the data** as the base — automatically. This is what "daily/weekly/monthly APIx series" (F-3.3) actually means: a genuine multi-point series once enough real periods exist, computed the same way whether there are 2 periods or 200. A thin wrapper (`build_and_write_series`) loads every file under `data/cleaned/`, calls `build_series`, and writes the result — no manual run-pairing needed for the common case, and `build_series` itself is a pure function fully testable with synthetic multi-period fixtures (this is how the daily/weekly/monthly logic gets proven correct before enough real days exist to show it for real).

## Revision tracking (F-3.5)

Each index computation writes `data/index/<comparison_id>.json` (never overwritten) containing: `frequency`, and a `series` list — one entry per period found, each with the period label, the base period it's relative to, the routes that had data in both periods, and all four formula outputs (when weights are available for every route in that period; simple relative always). `comparison_id` is a fresh UUID per computation — recomputing later (e.g. after a bug fix, or once more real days exist) produces a new file, and the revision history is simply every file that ever existed, same pattern as `data/raw/`/`data/cleaned/`.

## Back-test module (F-3.6)

`index/backtest.py` takes two aligned time series (list of `(period, value)` pairs) and computes MAPE and Pearson correlation — generic, works on any two series, tested with synthetic data. Not wired to a live DGCA/CPI feed in this phase (that's a separate future data-ingestion task); this module exists and is correct, ready to point at real reference data once enough real APIx history and a real reference series both exist. Matches the PRD's own stated fallback (§9): methodology as the deliverable, not a fully validated dataset, for the round-1 prototype.

## File layout

```
index/
  __init__.py
  weights.py       # load_weights() from config/weights.json
  formulas.py      # simple_relative, laspeyres, paasche, fisher
  aggregate.py     # representative_price(), period_of()
  build.py         # orchestrator: load 2 cleaned runs, compute, write versioned snapshot
  backtest.py      # mape(), pearson_correlation() over two aligned series
config/
  weights.json     # DGCA-sourced route weights, with source attribution
tests/
  test_index_weights.py
  test_index_formulas.py
  test_index_aggregate.py
  test_index_build.py
  test_index_backtest.py
data/
  index/<comparison_id>.json   # gitignored, versioned snapshots
```

## Verification plan

Since only one real cleaned run currently exists, part of implementation includes manually triggering a second real scraper + cleaning run so `index/build.py` can be demonstrated against a genuine two-point comparison on real data — not just synthetic test fixtures — before calling this phase done. This is the same "verify against real, already-collected or freshly-collected data" discipline every prior phase in this project has followed.
