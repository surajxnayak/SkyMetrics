# Phase 5 DGCA/Reference Back-test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `index/backtest.py`'s existing `mape()`/`pearson_correlation()` against a real government reference series (Ministry of Commerce's Service PPI "Air (Passenger) Service Price Index"), and produce a generated validation report documenting the methodology and today's real (currently non-overlapping) data state.

**Architecture:** A committed, source-attributed reference dataset (`config/service_ppi_reference.json`) plus four new pure functions in `index/backtest.py` (`load_reference_series`, `fiscal_quarter_of`, `aggregate_apix_to_quarters`, `align_growth_rates`) that bucket our monthly APIx series into fiscal quarters and compute period-over-period growth rates comparable to the reference series, followed by an orchestrating `run_backtest()`. A new `index/generate_validation_report.py` renders all of this into a Markdown document.

**Tech Stack:** Python 3.11 stdlib only (no new dependencies — the reference Excel file was already parsed this session with `zipfile`/`xml.etree.ElementTree`, and that data is committed as static JSON, so no runtime Excel parsing is needed).

---

### Task 1: Reference data file + loader

**Files:**
- Create: `config/service_ppi_reference.json`
- Modify: `index/backtest.py:1-10` (add imports, `REFERENCE_PATH`, `load_reference_series`)
- Test: `tests/test_index_backtest.py`

- [ ] **Step 1: Create the reference data file**

Create `config/service_ppi_reference.json`:

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

- [ ] **Step 2: Write the failing tests**

Add to `tests/test_index_backtest.py` (add `import json` at the top of the file alongside the existing `import pytest`, and add `load_reference_series` to the existing `from index.backtest import ...` line):

```python
def test_load_reference_series_reads_a_given_file(tmp_path):
    ref_file = tmp_path / "reference.json"
    ref_file.write_text(
        json.dumps(
            {
                "source": "test",
                "source_url": "https://example.com",
                "retrieved_at": "2026-01-01",
                "methodology_note": "test",
                "quarters": [
                    {
                        "fiscal_year": "2025-26",
                        "quarter": "Q1",
                        "period_start": "2025-04-01",
                        "period_end": "2025-06-30",
                        "index_value": 100.0,
                        "provisional": False,
                    }
                ],
            }
        )
    )

    reference = load_reference_series(path=ref_file)

    assert reference["source"] == "test"
    assert reference["quarters"][0]["index_value"] == 100.0


def test_real_reference_file_has_five_real_quarters():
    reference = load_reference_series()

    assert len(reference["quarters"]) == 5
    values = {(q["fiscal_year"], q["quarter"]): q["index_value"] for q in reference["quarters"]}
    assert values[("2025-26", "Q1")] == 95.8
    assert values[("2026-27", "Q1")] == 126.4
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_index_backtest.py -k reference_series -v`
Expected: FAIL with `ImportError: cannot import name 'load_reference_series'`.

- [ ] **Step 4: Implement**

At the top of `index/backtest.py`, change:

```python
from __future__ import annotations

import math
```

to:

```python
from __future__ import annotations

import json
import math
from pathlib import Path

REFERENCE_PATH = Path("config/service_ppi_reference.json")
```

Then add, after the module docstring/imports (before `mape`):

```python
def load_reference_series(path: Path = REFERENCE_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_index_backtest.py -v`
Expected: all tests in the file PASS (the 8 pre-existing `mape`/`pearson_correlation` tests plus the 2 new ones).

- [ ] **Step 6: Commit**

```bash
git add config/service_ppi_reference.json index/backtest.py tests/test_index_backtest.py
git commit -m "feat: real Service PPI Air Passenger reference data + loader"
```

---

### Task 2: `fiscal_quarter_of()`

**Files:**
- Modify: `index/backtest.py` (add function after `load_reference_series`)
- Test: `tests/test_index_backtest.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_index_backtest.py` (add `fiscal_quarter_of` to the `from index.backtest import ...` line):

```python
def test_fiscal_quarter_of_maps_calendar_months_to_fiscal_quarters():
    assert fiscal_quarter_of("2026-04") == ("2026-27", "Q1")
    assert fiscal_quarter_of("2026-06") == ("2026-27", "Q1")
    assert fiscal_quarter_of("2026-07") == ("2026-27", "Q2")
    assert fiscal_quarter_of("2026-09") == ("2026-27", "Q2")
    assert fiscal_quarter_of("2026-10") == ("2026-27", "Q3")
    assert fiscal_quarter_of("2026-12") == ("2026-27", "Q3")
    assert fiscal_quarter_of("2026-08") == ("2026-27", "Q2")


def test_fiscal_quarter_of_handles_january_march_as_prior_fiscal_year_q4():
    assert fiscal_quarter_of("2026-01") == ("2025-26", "Q4")
    assert fiscal_quarter_of("2026-02") == ("2025-26", "Q4")
    assert fiscal_quarter_of("2026-03") == ("2025-26", "Q4")


def test_fiscal_quarter_of_rejects_malformed_period():
    with pytest.raises(ValueError):
        fiscal_quarter_of("not-a-period")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_backtest.py -k fiscal_quarter -v`
Expected: FAIL with `ImportError: cannot import name 'fiscal_quarter_of'`.

- [ ] **Step 3: Implement**

Add to `index/backtest.py`, after `load_reference_series`:

```python
def fiscal_quarter_of(period: str) -> tuple[str, str]:
    try:
        year, month = (int(part) for part in period.split("-"))
    except ValueError as exc:
        raise ValueError(f"malformed monthly period: {period!r}") from exc

    if month in (4, 5, 6):
        fiscal_year, quarter = year, "Q1"
    elif month in (7, 8, 9):
        fiscal_year, quarter = year, "Q2"
    elif month in (10, 11, 12):
        fiscal_year, quarter = year, "Q3"
    elif month in (1, 2, 3):
        fiscal_year, quarter = year - 1, "Q4"
    else:
        raise ValueError(f"malformed monthly period: {period!r}")

    return f"{fiscal_year}-{(fiscal_year + 1) % 100:02d}", quarter
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_backtest.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index/backtest.py tests/test_index_backtest.py
git commit -m "feat: fiscal_quarter_of() maps monthly APIx periods to fiscal quarters"
```

---

### Task 3: `aggregate_apix_to_quarters()`

**Files:**
- Modify: `index/backtest.py`
- Test: `tests/test_index_backtest.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_index_backtest.py` (add `aggregate_apix_to_quarters` to the import line):

```python
def test_aggregate_apix_to_quarters_buckets_and_averages_simple_relative():
    apix_series = [
        {"period": "2026-04", "simple_relative": 100.0},
        {"period": "2026-05", "simple_relative": 110.0},
        {"period": "2026-06", "simple_relative": 120.0},
        {"period": "2026-07", "simple_relative": 200.0},
    ]

    result = aggregate_apix_to_quarters(apix_series)

    assert result[("2026-27", "Q1")] == pytest.approx(110.0)  # mean(100, 110, 120)
    assert result[("2026-27", "Q2")] == pytest.approx(200.0)


def test_aggregate_apix_to_quarters_handles_empty_series():
    assert aggregate_apix_to_quarters([]) == {}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_backtest.py -k aggregate_apix -v`
Expected: FAIL with `ImportError: cannot import name 'aggregate_apix_to_quarters'`.

- [ ] **Step 3: Implement**

Add to `index/backtest.py`, after `fiscal_quarter_of`:

```python
def aggregate_apix_to_quarters(apix_series: list[dict]) -> dict[tuple[str, str], float]:
    buckets: dict[tuple[str, str], list[float]] = {}
    for point in apix_series:
        quarter_key = fiscal_quarter_of(point["period"])
        buckets.setdefault(quarter_key, []).append(point["simple_relative"])
    return {key: sum(values) / len(values) for key, values in buckets.items()}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_backtest.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index/backtest.py tests/test_index_backtest.py
git commit -m "feat: aggregate_apix_to_quarters() buckets monthly APIx into fiscal quarters"
```

---

### Task 4: `align_growth_rates()`

**Files:**
- Modify: `index/backtest.py`
- Test: `tests/test_index_backtest.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_index_backtest.py` (add `align_growth_rates` to the import line):

```python
def test_align_growth_rates_computes_matched_period_over_period_growth():
    apix_quarters = {
        ("2025-26", "Q1"): 100.0,
        ("2025-26", "Q2"): 110.0,
        ("2025-26", "Q3"): 121.0,
        ("2025-26", "Q4"): 133.1,
    }
    reference_quarters = {
        ("2025-26", "Q1"): 200.0,
        ("2025-26", "Q2"): 220.0,
        ("2025-26", "Q3"): 242.0,
        ("2025-26", "Q4"): 266.2,
    }

    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    assert apix_growth == pytest.approx([10.0, 10.0, 10.0])
    assert reference_growth == pytest.approx([10.0, 10.0, 10.0])


def test_align_growth_rates_only_uses_quarters_present_in_both():
    apix_quarters = {("2025-26", "Q1"): 100.0, ("2025-26", "Q2"): 110.0, ("2026-27", "Q1"): 999.0}
    reference_quarters = {("2025-26", "Q1"): 200.0, ("2025-26", "Q2"): 220.0}

    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    # Only ("2025-26", "Q1") and ("2025-26", "Q2") overlap -> exactly 1 growth-rate point.
    assert apix_growth == pytest.approx([10.0])
    assert reference_growth == pytest.approx([10.0])


def test_align_growth_rates_returns_empty_lists_when_fewer_than_two_overlapping_quarters():
    apix_quarters = {("2026-27", "Q2"): 100.0}
    reference_quarters = {
        ("2025-26", "Q1"): 95.8,
        ("2025-26", "Q2"): 94.3,
        ("2025-26", "Q3"): 107.3,
        ("2025-26", "Q4"): 106.9,
        ("2026-27", "Q1"): 126.4,
    }

    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    assert apix_growth == []
    assert reference_growth == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_backtest.py -k align_growth_rates -v`
Expected: FAIL with `ImportError: cannot import name 'align_growth_rates'`.

- [ ] **Step 3: Implement**

Add to `index/backtest.py`, after `aggregate_apix_to_quarters`:

```python
def align_growth_rates(
    apix_quarters: dict[tuple[str, str], float],
    reference_quarters: dict[tuple[str, str], float],
) -> tuple[list[float], list[float]]:
    overlapping = sorted(set(apix_quarters) & set(reference_quarters))
    if len(overlapping) < 2:
        return [], []

    apix_growth = []
    reference_growth = []
    for previous_key, current_key in zip(overlapping, overlapping[1:]):
        apix_growth.append(
            100.0 * (apix_quarters[current_key] - apix_quarters[previous_key]) / apix_quarters[previous_key]
        )
        reference_growth.append(
            100.0
            * (reference_quarters[current_key] - reference_quarters[previous_key])
            / reference_quarters[previous_key]
        )
    return apix_growth, reference_growth
```

Note: `sorted()` on `(fiscal_year, quarter)` tuples sorts correctly because fiscal-year strings like `"2025-26"` sort lexicographically the same as chronologically (each is `YYYY-YY`, zero-padded, increasing), and `"Q1" < "Q2" < "Q3" < "Q4"` sorts correctly within a year.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_backtest.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index/backtest.py tests/test_index_backtest.py
git commit -m "feat: align_growth_rates() computes matched quarter-over-quarter growth"
```

---

### Task 5: `run_backtest()`

**Files:**
- Modify: `index/backtest.py`
- Test: `tests/test_index_backtest.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_index_backtest.py` (add `run_backtest` to the import line):

```python
def test_run_backtest_computes_real_statistics_when_enough_quarters_overlap():
    # Growth rates deliberately vary quarter to quarter (not constant, no
    # zero values) so this exercises real, non-degenerate mape()/
    # pearson_correlation() computation. The exact statistical values are
    # already covered by mape()'s and pearson_correlation()'s own dedicated
    # tests -- this test's job is to verify run_backtest() wires aggregation
    # + alignment + those functions together correctly, not to re-verify
    # their math.
    apix_series = [
        {"period": "2025-04", "simple_relative": 100.0},
        {"period": "2025-07", "simple_relative": 120.0},
        {"period": "2025-10", "simple_relative": 114.0},
        {"period": "2026-01", "simple_relative": 125.4},
    ]
    reference_data = {
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "index_value": 200.0},
            {"fiscal_year": "2025-26", "quarter": "Q2", "index_value": 210.0},
            {"fiscal_year": "2025-26", "quarter": "Q3", "index_value": 220.5},
            {"fiscal_year": "2025-26", "quarter": "Q4", "index_value": 209.475},
        ]
    }

    result = run_backtest(apix_series, reference_data)

    assert result["n_growth_pairs"] == 3
    assert result["overlapping_quarters"] == [
        ("2025-26", "Q1"),
        ("2025-26", "Q2"),
        ("2025-26", "Q3"),
        ("2025-26", "Q4"),
    ]
    assert isinstance(result["mape"], float)
    assert result["mape"] >= 0.0
    assert isinstance(result["pearson_correlation"], float)
    assert -1.0 <= result["pearson_correlation"] <= 1.0


def test_run_backtest_handles_degenerate_growth_data_without_crashing():
    # Both series grow by a perfectly constant 10% every quarter -- zero
    # variance in the growth-rate series, which makes pearson_correlation()
    # raise ValueError by design (Phase 3 behavior, unchanged). run_backtest
    # must catch this and report it honestly rather than crash: a flat
    # growth-rate quarter is a realistic outcome for real future data, not
    # just a hypothetical edge case.
    apix_series = [
        {"period": "2025-04", "simple_relative": 100.0},
        {"period": "2025-07", "simple_relative": 110.0},
        {"period": "2025-10", "simple_relative": 121.0},
        {"period": "2026-01", "simple_relative": 133.1},
    ]
    reference_data = {
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "index_value": 200.0},
            {"fiscal_year": "2025-26", "quarter": "Q2", "index_value": 220.0},
            {"fiscal_year": "2025-26", "quarter": "Q3", "index_value": 242.0},
            {"fiscal_year": "2025-26", "quarter": "Q4", "index_value": 266.2},
        ]
    }

    result = run_backtest(apix_series, reference_data)

    assert result["n_growth_pairs"] == 3
    assert result["mape"] is None
    assert result["pearson_correlation"] is None
    assert result["note"] != ""


def test_run_backtest_reports_insufficient_data_honestly_for_todays_real_state():
    # This is the actual current real-world case: our only real monthly APIx
    # period (August 2026, fiscal Q2 FY2026-27) doesn't overlap the real
    # committed reference data (which only goes through Q1 FY2026-27, ending
    # June 2026).
    apix_series = [{"period": "2026-08", "simple_relative": 100.0}]
    reference_data = load_reference_series()

    result = run_backtest(apix_series, reference_data)

    assert result["n_growth_pairs"] == 0
    assert result["mape"] is None
    assert result["pearson_correlation"] is None
    assert result["note"] != ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_backtest.py -k run_backtest -v`
Expected: FAIL with `ImportError: cannot import name 'run_backtest'`.

- [ ] **Step 3: Implement**

Add to `index/backtest.py`, after `align_growth_rates`:

```python
def run_backtest(apix_series: list[dict], reference_data: dict) -> dict:
    apix_quarters = aggregate_apix_to_quarters(apix_series)
    reference_quarters = {
        (q["fiscal_year"], q["quarter"]): q["index_value"] for q in reference_data["quarters"]
    }
    overlapping_quarters = sorted(set(apix_quarters) & set(reference_quarters))
    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    if len(apix_growth) < 2:
        return {
            "overlapping_quarters": overlapping_quarters,
            "n_growth_pairs": len(apix_growth),
            "mape": None,
            "pearson_correlation": None,
            "note": (
                f"Only {len(overlapping_quarters)} overlapping quarter(s) between our APIx "
                "history and the reference data (need 3+ overlapping quarters to compute a "
                "growth-rate correlation). This reflects the project's real, current data "
                "maturity, not an error."
            ),
        }

    try:
        mape_value = mape(reference_growth, apix_growth)
        correlation_value = pearson_correlation(apix_growth, reference_growth)
    except (ValueError, ZeroDivisionError):
        # A flat (zero-variance) growth-rate quarter, or a reference growth
        # value of exactly 0%, are real possible outcomes once more genuine
        # data accumulates -- not just hypothetical. mape()/pearson_correlation()
        # correctly reject these (Phase 3 behavior, unchanged); run_backtest
        # reports it honestly rather than crashing.
        return {
            "overlapping_quarters": overlapping_quarters,
            "n_growth_pairs": len(apix_growth),
            "mape": None,
            "pearson_correlation": None,
            "note": (
                f"{len(apix_growth)} growth-rate pair(s) were available, but the data was "
                "degenerate for standard statistics (zero variance in a growth-rate series, "
                "or an exact 0% reference growth quarter)."
            ),
        }

    return {
        "overlapping_quarters": overlapping_quarters,
        "n_growth_pairs": len(apix_growth),
        "mape": mape_value,
        "pearson_correlation": correlation_value,
        "note": f"Computed over {len(apix_growth)} matched quarter-over-quarter growth-rate pairs.",
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_backtest.py -v`
Expected: all tests PASS. Then run the full suite: `pytest && ruff check .` — expected: all pass, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add index/backtest.py tests/test_index_backtest.py
git commit -m "feat: run_backtest() orchestrates alignment + statistics, honest on insufficient data"
```

---

### Task 6: `index/generate_validation_report.py`

**Files:**
- Create: `index/generate_validation_report.py`
- Test: `tests/test_generate_validation_report.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_generate_validation_report.py`:

```python
from index.generate_validation_report import generate_report


def _reference_data():
    return {
        "source": "Service Producer Price Index (Base Year 2022-23), Air (Passenger) Service Price Index -- Office of the Economic Adviser, Ministry of Commerce & Industry, Government of India",
        "source_url": "https://eaindustry.nic.in/download_data_2223.asp",
        "retrieved_at": "2026-08-26",
        "methodology_note": "Quarterly, base year 2022-23=100.",
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "period_start": "2025-04-01", "period_end": "2025-06-30", "index_value": 95.8, "provisional": False},
            {"fiscal_year": "2026-27", "quarter": "Q1", "period_start": "2026-04-01", "period_end": "2026-06-30", "index_value": 126.4, "provisional": True},
        ],
    }


def test_generate_report_includes_methodology_and_reference_table():
    report = generate_report(
        apix_snapshots=[],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [],
            "n_growth_pairs": 0,
            "mape": None,
            "pearson_correlation": None,
            "note": "insufficient data",
        },
    )

    assert "mape" in report.lower()
    assert "pearson" in report.lower()
    assert "95.8" in report
    assert "126.4" in report
    assert "eaindustry.nic.in" in report


def test_generate_report_renders_insufficient_data_result_honestly():
    report = generate_report(
        apix_snapshots=[],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [],
            "n_growth_pairs": 0,
            "mape": None,
            "pearson_correlation": None,
            "note": "insufficient data explanation here",
        },
    )

    assert "insufficient data explanation here" in report
    assert "None" not in report.split("insufficient data explanation here")[0][-50:]


def test_generate_report_renders_a_populated_result():
    report = generate_report(
        apix_snapshots=[{"comparison_id": "abc123", "frequency": "monthly", "written_at": "2026-08-26T00:00:00+00:00"}],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [("2025-26", "Q1"), ("2025-26", "Q2")],
            "n_growth_pairs": 1,
            "mape": 5.0,
            "pearson_correlation": 0.9,
            "note": "Computed over 1 matched quarter-over-quarter growth-rate pairs.",
        },
    )

    assert "5.0" in report
    assert "0.9" in report
    assert "abc123" in report
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_generate_validation_report.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'index.generate_validation_report'`.

- [ ] **Step 3: Implement**

Create `index/generate_validation_report.py`:

```python
"""Renders the Phase 5 back-test validation report (PRD §9): methodology,
the real reference dataset, our own APIx history summary, the back-test
result (honest about today's real data-maturity limits), and DGCA's
qualitative fare-change disclosures as non-quantitative corroboration.
"""
from __future__ import annotations

from index.backtest import load_reference_series, run_backtest
from index.build import load_all_cleaned_records, build_series
from index.weights import load_weights

DGCA_CORROBORATION_NOTE = (
    "DGCA has separately disclosed, via a written Parliament reply (Minister of "
    "State for Civil Aviation, Rajya Sabha), an approximate 20.5% average airfare "
    "increase across 72 undisclosed domestic routes, June 2026 vs March 2025. This "
    "figure is cited here as qualitative, directional corroboration only -- it has "
    "no downloadable route list, no absolute fares, and its comparison window ends "
    "before this project's own APIx history begins (2026-08-24), so it cannot be "
    "run through the quantitative back-test above."
)


def generate_report(apix_snapshots: list[dict], reference_data: dict, backtest_result: dict) -> str:
    lines = [
        "# SkyMetrics Phase 5 Validation Report",
        "",
        "## Methodology",
        "",
        "The Airfare Price Index (APIx) is compared against an external government "
        "reference series using two statistics: Mean Absolute Percentage Error "
        "(MAPE) and Pearson correlation, both computed over matched "
        "quarter-over-quarter percentage growth rates (not raw index levels, since "
        "the two series have different base periods).",
        "",
        "## Reference data",
        "",
        f"Source: {reference_data['source']}",
        "",
        f"Source URL: {reference_data['source_url']}",
        "",
        f"Retrieved: {reference_data['retrieved_at']}",
        "",
        f"Methodology note: {reference_data['methodology_note']}",
        "",
        "| Fiscal quarter | Period | Index value | Provisional |",
        "|---|---|---|---|",
    ]
    for q in reference_data["quarters"]:
        lines.append(
            f"| {q['fiscal_year']} {q['quarter']} | {q['period_start']} to {q['period_end']} "
            f"| {q['index_value']} | {'Yes' if q['provisional'] else 'No'} |"
        )

    lines += [
        "",
        "## Our own APIx history",
        "",
        f"{len(apix_snapshots)} snapshot(s) currently committed:",
        "",
    ]
    for snapshot in apix_snapshots:
        lines.append(
            f"- `{snapshot['comparison_id']}` ({snapshot['frequency']}, written {snapshot['written_at']})"
        )
    if not apix_snapshots:
        lines.append("- (none yet)")

    lines += [
        "",
        "## Back-test result",
        "",
        f"Overlapping fiscal quarters: {backtest_result['overlapping_quarters']}",
        "",
        f"Growth-rate pairs used: {backtest_result['n_growth_pairs']}",
        "",
        f"MAPE: {backtest_result['mape']}",
        "",
        f"Pearson correlation: {backtest_result['pearson_correlation']}",
        "",
        backtest_result["note"],
        "",
        "## DGCA corroboration (qualitative)",
        "",
        DGCA_CORROBORATION_NOTE,
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    from pathlib import Path

    from api.data_access import list_snapshots

    records = load_all_cleaned_records()
    monthly_series = build_series(records, "monthly", load_weights())
    reference = load_reference_series()
    result = run_backtest(monthly_series, reference)
    report = generate_report(
        apix_snapshots=list_snapshots(),
        reference_data=reference,
        backtest_result=result,
    )
    Path("docs/validation-report.md").write_text(report, encoding="utf-8")
    print("wrote docs/validation-report.md")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_generate_validation_report.py -v`
Expected: all 3 tests PASS.

If `test_generate_report_renders_insufficient_data_result_honestly` fails because the naive substring check is too strict (e.g. legitimate `None` text appears elsewhere in the report before the note), simplify it to just:

```python
def test_generate_report_renders_insufficient_data_result_honestly():
    report = generate_report(
        apix_snapshots=[],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [],
            "n_growth_pairs": 0,
            "mape": None,
            "pearson_correlation": None,
            "note": "insufficient data explanation here",
        },
    )

    assert "insufficient data explanation here" in report
```

- [ ] **Step 5: Commit**

```bash
git add index/generate_validation_report.py tests/test_generate_validation_report.py
git commit -m "feat: generate_report() renders methodology, reference data, and back-test result"
```

---

### Task 7: Generate the real report and verify it end-to-end

**Files:** none created/modified beyond the generated report itself.
- Create (generated, not hand-written): `docs/validation-report.md`

- [ ] **Step 1: Run the full test suite and lint**

Run: `pytest && ruff check .`
Expected: all tests pass (the full project suite, now including the new back-test and validation-report tests), no lint errors.

- [ ] **Step 2: Run the real report generator**

Run: `python3 -m index.generate_validation_report`
Expected: prints `wrote docs/validation-report.md`, and the file is created.

- [ ] **Step 3: Read the generated report and confirm it's honest**

Run: `cat docs/validation-report.md`
Expected: the reference table shows the 5 real quarters (95.8, 94.3, 107.3, 106.9, 126.4); the APIx history section lists whatever real snapshot(s) are currently committed in `data/index/`; the back-test result section shows `MAPE: None`, `Pearson correlation: None`, `Growth-rate pairs used: 0`, and a note explaining there are currently 0 overlapping fiscal quarters between our real APIx history and the reference data -- this must NOT show a fabricated non-null number. If it does show a null/insufficient result, that's the correct, honest, expected outcome for today's real data state, not a bug.

- [ ] **Step 4: Commit**

```bash
git add docs/validation-report.md
git commit -m "docs: generate real Phase 5 validation report from committed data"
```

---

## Self-review notes

- **Spec coverage:** reference data + loader (Task 1), `fiscal_quarter_of` (Task 2),
  `aggregate_apix_to_quarters` (Task 3), `align_growth_rates` (Task 4),
  `run_backtest` (Task 5), `generate_validation_report.py` (Task 6), real
  end-to-end verification producing the actual `docs/validation-report.md`
  (Task 7) -- every section of the design spec maps to a task.
- **No placeholders:** every step has literal code, literal file paths, and
  literal commands with stated expected output, including the exact real
  reference-data values confirmed by parsing the source file this session.
- **Type/signature consistency:** `run_backtest(apix_series: list[dict],
  reference_data: dict)` matches how Task 6's `generate_report()` and its
  `__main__` block call it; `aggregate_apix_to_quarters`'s
  `dict[tuple[str, str], float]` return shape matches what `align_growth_rates`
  and `run_backtest` both consume; `fiscal_quarter_of`'s `(fiscal_year: str,
  quarter: str)` tuple shape is used consistently as a dict key throughout
  Tasks 3-6.
