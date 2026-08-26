# SkyMetrics Phase 5 — DGCA/Reference Back-test Design

Date: 2026-08-26
Status: Approved for implementation

## Context

Phase 5 (PRD §9, and the SIH problem statement's "Expected Solution": "demonstrate at
least 30 days of back-tested results against publicly available DGCA monthly
average-fare data") needs the project's APIx index checked against an external
reference. `index/backtest.py` already has `mape()` and `pearson_correlation()`
(Phase 3), tested only with synthetic data, never wired to a real reference series.

Research this session (see chat log, not repeated in full here) established that
the literal ask — a DGCA-published monthly average-fare series — does not exist in
usable form:

- DGCA's only public fare data is sporadic Parliament written-answer disclosures
  (e.g. "avg fare +20.5% across 72 undisclosed routes, June 2026 vs March 2025") —
  no route list, no rupee figures, no downloadable file, no fixed schedule. That
  specific window also predates our own APIx history (which starts 2026-08-24),
  so it can't be used as a calibration point regardless.
- The PRD's own named "Dataset Link" (`esankhyiki.mospi.gov.in`) is MoSPI's general
  macroeconomic statistics portal (CPI, IIP, GDP) — not a curated aviation/fare
  dataset.
- MoSPI's new CPI (base 2024=100, launched Feb 2026) does have an "Air fares" line,
  but it's brand new (thin history) and only published as PDF press releases.

What **does** exist, confirmed by downloading and parsing the real file: the
Ministry of Commerce & Industry's Office of the Economic Adviser publishes a
**Service Producer Price Index** (`eaindustry.nic.in/download_data_2223.asp`,
`SPPIs_quarterly_index_202608.xlsx`) containing a dedicated **"Air (Passenger)
Service Price Index"** row, quarterly, base year 2022-23. The file was downloaded
and parsed this session (pure Python stdlib — `zipfile` + `xml.etree.ElementTree`,
the xlsx format is just a zip of XML, no new dependency needed) to confirm the
real values:

| Fiscal quarter | Calendar period | Index value | Provisional? |
|---|---|---|---|
| Q1 FY2025-26 | Apr-Jun 2025 | 95.8 | No |
| Q2 FY2025-26 | Jul-Sep 2025 | 94.3 | No |
| Q3 FY2025-26 | Oct-Dec 2025 | 107.3 | No |
| Q4 FY2025-26 | Jan-Mar 2026 | 106.9 | No |
| Q1 FY2026-27 | Apr-Jun 2026 | 126.4 | Yes |

(Earlier quarters are not compiled — the source's own footnote: "price reference
period is FY 2025-26".)

This is the project's chosen reference series: real, official Government of India
data, downloadable in a structured format, with a dedicated air-passenger line
(not a bundled "Transport" catch-all). This is a deliberate, documented
substitution for the PRD's literal "DGCA" wording — the validation report must
explain this reasoning transparently (why DGCA/MoSPI's own named link don't yield
a usable series, why this source was chosen instead), consistent with the PRD's
own §9 allowance for transparent handling of real-world data limitations. DGCA's
own sporadic parliamentary figures are cited in the report as qualitative
corroboration, not run through the quantitative back-test.

A real, load-bearing constraint stays regardless of source: our own APIx daily
history only starts 2026-08-24, and the most recent published reference quarter
ends June 2026 — there is currently no overlapping period to compute a real
correlation over. The next reference quarter (Jul-Sep 2026) publishes around
2026-11-25 and will partially overlap our accumulating history. This is expected
and handled explicitly, not papered over (see Error handling below).

## Goals

- A committed, source-attributed reference dataset (`config/service_ppi_reference.json`)
  with the 5 real quarters above.
- `index/backtest.py` gains the ability to align our own monthly APIx series
  against this quarterly reference and run `mape()`/`pearson_correlation()` over
  the aligned points — genuinely wired, not a hardcoded demo number.
- The alignment compares **period-over-period growth rates**, not raw index
  levels — the two series have different base periods (ours: whatever period we
  first collected; the reference's: FY2022-23=100), so comparing raw levels would
  conflate "different starting point" with "different price movement." Growth
  rates are base-period-independent and the methodologically correct comparison.
- An honest result when there isn't enough overlapping data yet (today's actual
  situation) — no fabricated numbers, a clear structured "not enough data" result.
- A generated validation report (`docs/validation-report.md`, produced by a
  script so it can be regenerated as more history accumulates) combining
  methodology, the reference table, our own APIx history summary, the back-test
  result (honest N=0 today), and DGCA's qualitative corroboration.

## Non-goals

- No live-fetching of the reference spreadsheet at runtime. It updates quarterly;
  a committed, source-attributed JSON snapshot (same pattern as
  `config/weights.json`) is simpler and more auditable than re-parsing a
  government Excel file on every run. Refreshing it is a manual, documented
  step (download, re-run the same stdlib parsing this session used, verify
  against the source, update the JSON) — not automated in this phase.
- No change to `index/aggregate.py`'s `VALID_FREQUENCIES` or `period_of()`.
  Fiscal-quarter bucketing is new logic that lives entirely in
  `index/backtest.py`, operating on an already-built monthly APIx series —
  Phase 3's already-shipped, already-reviewed aggregation code is untouched.
- No CPI Air Fares integration (considered and dropped this session — thinner
  history, PDF-locked, marginal value once the Service PPI series is in).
- No automated re-fetch/refresh cron for the reference data (quarterly cadence
  doesn't justify it; revisit only if this becomes a recurring manual burden).

## Design

### Reference data (`config/service_ppi_reference.json`)

```json
{
  "source": "Service Producer Price Index (Base Year 2022-23), Air (Passenger) Service Price Index -- Office of the Economic Adviser, Ministry of Commerce & Industry, Government of India",
  "source_url": "https://eaindustry.nic.in/download_data_2223.asp",
  "retrieved_at": "2026-08-26",
  "methodology_note": "Quarterly, base year 2022-23=100. Index not compiled before Q1 FY2025-26 (source's own footnote: price reference period is FY2025-26). Q1 FY2026-27 is marked provisional by the source.",
  "quarters": [
    {"fiscal_year": "2025-26", "quarter": "Q1", "period_start": "2025-04-01", "period_end": "2025-06-30", "index_value": 95.8, "provisional": false},
    {"fiscal_year": "2025-26", "quarter": "Q2", "period_start": "2025-07-01", "period_end": "2025-09-30", "index_value": 94.3, "provisional": false},
    {"fiscal_year": "2025-26", "quarter": "Q3", "period_start": "2025-10-01", "period_end": "2025-12-31", "index_value": 107.3, "provisional": false},
    {"fiscal_year": "2025-26", "quarter": "Q4", "period_start": "2026-01-01", "period_end": "2026-03-31", "index_value": 106.9, "provisional": false},
    {"fiscal_year": "2026-27", "quarter": "Q1", "period_start": "2026-04-01", "period_end": "2026-06-30", "index_value": 126.4, "provisional": true}
  ]
}
```

### `index/backtest.py` additions

- `load_reference_series(path: Path = REFERENCE_PATH) -> dict` — reads and returns
  the JSON above.
- `fiscal_quarter_of(period: str) -> tuple[str, str]` — given a monthly APIx
  period string (`"YYYY-MM"`, as produced by `index.aggregate.period_of` with
  `frequency="monthly"`), returns `(fiscal_year, quarter)`, e.g. `"2026-08"` →
  `("2026-27", "Q2")`. India's fiscal year runs April-March: calendar months
  Apr-Jun = Q1, Jul-Sep = Q2, Oct-Dec = Q3, Jan-Mar = Q4 (Jan-Mar belongs to the
  fiscal year that *started* the previous April, e.g. `"2026-02"` → `("2025-26",
  "Q4")`).
- `aggregate_apix_to_quarters(apix_series: list[dict]) -> dict[tuple[str, str], float]` —
  takes a monthly-frequency APIx `series` list (each point has `period` and
  `simple_relative`, per `index.build`'s existing snapshot format), buckets by
  `fiscal_quarter_of(point["period"])`, and averages `simple_relative` within
  each quarter. Uses `simple_relative` specifically (not laspeyres/paasche/fisher)
  because it's unconditionally present on every point, unlike the weighted
  formulas which only appear when routes fully overlap the base period.
- `align_growth_rates(apix_quarters: dict, reference_quarters: dict) -> tuple[list[float], list[float]]` —
  finds fiscal quarters present in both inputs, sorted chronologically, computes
  each series' own consecutive-quarter percentage growth independently (so both
  lists are on a comparable "rate of change" basis regardless of differing base
  periods), and returns the two aligned growth-rate lists. Needs at least 3
  overlapping quarters to produce 2 growth-rate points (the minimum
  `pearson_correlation` requires) — returns two empty lists otherwise.
- `run_backtest(apix_series: list[dict], reference_data: dict) -> dict` —
  orchestrates the above. Returns:
  ```python
  {
      "overlapping_quarters": [...],   # the fiscal quarters used, e.g. ["2025-26 Q4", "2026-27 Q1"]
      "n_growth_pairs": int,
      "mape": float | None,
      "pearson_correlation": float | None,
      "note": str,                     # explains the result, esp. when None
  }
  ```
  When `n_growth_pairs < 2`, `mape`/`pearson_correlation` are `None` and `note`
  explains why (e.g. `"Only 1 overlapping quarter (need 3+ for a growth-rate
  correlation); next reference quarter (Q2 FY2026-27) publishes ~2026-11-25."`).
  This is the actual real-world result today — the function must handle it
  correctly, not treat it as an edge case to skip testing.

### Validation report (`index/generate_validation_report.py`, new file)

- `generate_report(apix_snapshots: list[dict], reference_data: dict, backtest_result: dict) -> str` —
  pure function, returns a Markdown document as a string (testable without
  touching the filesystem). Sections: methodology (cites `mape`/
  `pearson_correlation`'s formulas), the reference table (the 5 real quarters,
  with source attribution), a summary of our own APIx history (how many
  snapshots exist, what date range they cover — pulled from
  `api.data_access.list_snapshots` or an equivalent direct read of
  `data/index/*.json`), the back-test result section (rendering
  `run_backtest()`'s output honestly, including the "not enough data yet" case),
  and a closing paragraph citing DGCA's parliamentary fare-change figures as
  qualitative, non-quantitative corroboration, with an explicit note on why they
  aren't part of the quantitative comparison (see Context above).
- `if __name__ == "__main__":` block calls `generate_report()` with real data
  (loading the latest monthly APIx snapshot via existing `index.build`/
  `api.data_access` helpers and `load_reference_series()`) and writes the result
  to `docs/validation-report.md`.

## Error handling

- `run_backtest()` never raises for insufficient overlapping data — it's an
  expected, current, real state, not an error condition. It only propagates
  exceptions from malformed input (e.g. a reference file that fails JSON
  parsing) — consistent with the project's existing fail-loud convention for
  genuinely malformed data.
- `fiscal_quarter_of()` raises `ValueError` on a malformed period string
  (mirrors `index.aggregate.period_of`'s existing style).

## Testing

Same TDD discipline as every prior phase, new tests added to the existing
`tests/test_index_backtest.py`:

- `fiscal_quarter_of()`: table-driven tests covering all four fiscal quarters
  and the fiscal-year rollover at January (calendar Jan/Feb/Mar belong to the
  *previous* fiscal year's Q4).
- `aggregate_apix_to_quarters()`: synthetic multi-month APIx series bucketing
  correctly into quarters, averaging `simple_relative` within a quarter.
- `align_growth_rates()`: both the normal case (3+ overlapping quarters,
  synthetic values with a known expected growth-rate pair) and the actual
  current real-world case (0-2 overlapping quarters → empty lists).
- `run_backtest()`: both the "enough data" path (synthetic, asserting real
  `mape`/`pearson_correlation` values) and today's actual real path (our real
  committed APIx history + the real reference data → `mape`/`pearson_correlation`
  are `None`, `note` is populated, no exception).
- `generate_report()`: asserts the reference table, methodology section, and
  the correct rendering of both a populated and a `None` back-test result
  appear in the output string.

## Verification plan

Run `generate_report()` against the real, currently-committed APIx history and
the real reference data committed in this sub-project, and read the actual
generated `docs/validation-report.md` output to confirm it honestly reflects
today's real (thin) data state — not a synthetic demo. This is the same
"verify against real data" discipline used in every prior phase.
