# Phase 3 Index Construction (APIx) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Real-time Airfare Price Index (APIx) — real DGCA-sourced route weights, all four PRD-named formulas (simple relative, Laspeyres, Paasche, Fisher), period-based aggregation that produces a genuine multi-point series as more real days accumulate, versioned output, and a tested (if not yet live-fed) back-test utility.

**Architecture:** A new `index/` package. `weights.py` loads real, committed DGCA-sourced route weights. `formulas.py` implements the four index formulas as pure functions. `aggregate.py` computes a representative price per (route, period) from cleaned data, excluding flagged outliers. `build.py` buckets all available cleaned records into periods, treats the earliest period as the base, and computes every later period's index value relative to it — this is a pure function (`build_series`) wrapped by a thin I/O function (`build_and_write_series`) that writes a versioned JSON snapshot. `backtest.py` is a standalone MAPE/correlation utility, correct and tested now, not yet wired to a live reference feed.

**Tech Stack:** Same as Phases 1-2 — stdlib only (`json`, `pathlib`, `datetime`, `statistics`/`math`), `pytest` for tests, `ruff` for lint.

**Reference:** `docs/superpowers/specs/2026-08-24-phase3-index-construction-design.md` for the full rationale — in particular, why Laspeyres/Paasche/Fisher will numerically coincide right now (one static weight source, no time-varying weights), and why a real multi-point series requires the daily cron to actually accumulate days.

---

### Task 1: Real DGCA-sourced route weights

**Files:**
- Create: `config/weights.json`
- Create: `index/__init__.py`
- Create: `index/weights.py`
- Create: `tests/test_index_weights.py`
- Modify: `.gitignore`

- [ ] **Step 1: Add `data/index/` to `.gitignore`**

Add one line so this phase's output is never accidentally committed (the file currently ends with `.env` then `.DS_Store`, after `data/raw/` and `data/cleaned/`):

```
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/
.pytest_cache/
.ruff_cache/
data/raw/
data/cleaned/
data/index/
.env
.DS_Store
```

- [ ] **Step 2: Create `index/__init__.py`** (empty package marker)

```bash
mkdir -p index
touch index/__init__.py
```

- [ ] **Step 3: Create `config/weights.json`**

Real 2025 full-year DGCA domestic passenger-traffic data (both directions combined), sourced via `Vonter/india-aviation-traffic` (ODbL license), which republishes DGCA's own Monthly Statistics (Domestic Air Transport) page as structured CSV:

```json
{
  "source": "DGCA Monthly Statistics (Domestic Air Transport), via https://github.com/Vonter/india-aviation-traffic (ODbL license)",
  "period": "2025 full calendar year, both directions combined",
  "computed_at": "2026-08-24",
  "weights": {
    "DEL-BOM": 0.4331,
    "DEL-BLR": 0.3061,
    "BOM-BLR": 0.2608
  }
}
```

- [ ] **Step 4: Write the failing tests**

```python
# tests/test_index_weights.py
import json

from index.weights import load_weights, route_key


def test_load_weights_reads_a_given_file(tmp_path):
    weights_file = tmp_path / "weights.json"
    weights_file.write_text(
        json.dumps({"source": "test", "weights": {"DEL-BOM": 0.5, "DEL-BLR": 0.5}})
    )

    weights = load_weights(weights_path=weights_file)

    assert weights == {"DEL-BOM": 0.5, "DEL-BLR": 0.5}


def test_route_key_formats_origin_destination():
    assert route_key("DEL", "BOM") == "DEL-BOM"


def test_real_weights_file_has_all_three_basket_routes():
    weights = load_weights()
    assert set(weights.keys()) == {"DEL-BOM", "DEL-BLR", "BOM-BLR"}
    assert abs(sum(weights.values()) - 1.0) < 1e-6
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `pytest tests/test_index_weights.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'index.weights'`

- [ ] **Step 6: Write `index/weights.py`**

```python
"""Route weights for index construction, sourced from real DGCA data (PRD F-3.1).

See config/weights.json for source attribution. Weights are a static,
committed snapshot -- DGCA's own publication cadence is monthly/annual, not
something to re-fetch per index run. Refresh config/weights.json by hand
when a newer DGCA annual release is available.
"""
from __future__ import annotations

import json
from pathlib import Path

WEIGHTS_PATH = Path("config/weights.json")


def load_weights(weights_path: Path = WEIGHTS_PATH) -> dict[str, float]:
    payload = json.loads(weights_path.read_text(encoding="utf-8"))
    return payload["weights"]


def route_key(origin: str, destination: str) -> str:
    return f"{origin}-{destination}"
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest tests/test_index_weights.py -v`
Expected: PASS (3 tests)

- [ ] **Step 8: Run the full suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS (54 tests: 51 existing + 3 new)

- [ ] **Step 9: Commit**

```bash
git add config/weights.json index/__init__.py index/weights.py tests/test_index_weights.py .gitignore
git commit -m "feat: real DGCA-sourced route weights for index construction"
```

---

### Task 2: Index formulas

**Files:**
- Create: `index/formulas.py`
- Create: `tests/test_index_formulas.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_index_formulas.py
import math

import pytest

from index.formulas import fisher, laspeyres, paasche, simple_relative

BASE = {"DEL-BOM": 6000.0, "DEL-BLR": 7000.0, "BOM-BLR": 5000.0}
CURRENT = {"DEL-BOM": 6600.0, "DEL-BLR": 7000.0, "BOM-BLR": 5500.0}
WEIGHTS = {"DEL-BOM": 0.4331, "DEL-BLR": 0.3061, "BOM-BLR": 0.2608}


def test_simple_relative_is_unweighted_average_of_relatives():
    # relatives: 1.10, 1.00, 1.10 -> mean 1.06667 -> *100
    assert simple_relative(BASE, CURRENT) == pytest.approx(106.66666666666667)


def test_laspeyres_uses_base_weights():
    # hand-computed: 0.4331*1.1 + 0.3061*1.0 + 0.2608*1.1, weights already sum to 1.0
    assert laspeyres(BASE, CURRENT, WEIGHTS) == pytest.approx(106.939)


def test_paasche_uses_current_weights():
    assert paasche(BASE, CURRENT, WEIGHTS) == pytest.approx(106.939)


def test_laspeyres_and_paasche_coincide_with_the_same_static_weights():
    # Documents the design spec's known limitation directly: with only one
    # weight source, current-period weights equal base-period weights.
    assert laspeyres(BASE, CURRENT, WEIGHTS) == paasche(BASE, CURRENT, WEIGHTS)


def test_fisher_is_geometric_mean_of_laspeyres_and_paasche():
    l = laspeyres(BASE, CURRENT, WEIGHTS)
    p = paasche(BASE, CURRENT, WEIGHTS)
    assert fisher(l, p) == pytest.approx(math.sqrt(l * p))


def test_index_equals_100_when_prices_unchanged():
    assert simple_relative(BASE, BASE) == pytest.approx(100.0)
    assert laspeyres(BASE, BASE, WEIGHTS) == pytest.approx(100.0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_formulas.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'index.formulas'`

- [ ] **Step 3: Write `index/formulas.py`**

```python
"""Index formulas (PRD F-3.2): simple relative, Laspeyres, Paasche, Fisher.

All four are implemented and distinct in code, but with only one static
weight source (see weights.py), Paasche's current-period weights equal
Laspeyres' base-period weights for every period we can currently compute --
so Laspeyres, Paasche, and Fisher will numerically coincide until a second,
differently-dated weight snapshot exists. Not a bug; see the design spec's
"Formulas" section.
"""
from __future__ import annotations

import math


def simple_relative(base_prices: dict[str, float], current_prices: dict[str, float]) -> float:
    relatives = [current_prices[route] / base_prices[route] for route in base_prices]
    return 100.0 * sum(relatives) / len(relatives)


def laspeyres(
    base_prices: dict[str, float],
    current_prices: dict[str, float],
    base_weights: dict[str, float],
) -> float:
    weighted_sum = sum(
        base_weights[route] * current_prices[route] / base_prices[route] for route in base_prices
    )
    return 100.0 * weighted_sum / sum(base_weights.values())


def paasche(
    base_prices: dict[str, float],
    current_prices: dict[str, float],
    current_weights: dict[str, float],
) -> float:
    weighted_sum = sum(
        current_weights[route] * current_prices[route] / base_prices[route] for route in base_prices
    )
    return 100.0 * weighted_sum / sum(current_weights.values())


def fisher(laspeyres_value: float, paasche_value: float) -> float:
    return math.sqrt(laspeyres_value * paasche_value)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_formulas.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (60 tests: 54 from Task 1 + 6 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add index/formulas.py tests/test_index_formulas.py
git commit -m "feat: simple relative, Laspeyres, Paasche, Fisher index formulas"
```

---

### Task 3: Representative price aggregation

**Files:**
- Create: `index/aggregate.py`
- Create: `tests/test_index_aggregate.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_index_aggregate.py
from datetime import datetime, timezone

import pytest

from index.aggregate import period_of, representative_prices


def _record(origin, destination, total_fare, collected_at, status="available", is_outlier=False):
    return {
        "origin": origin,
        "destination": destination,
        "total_fare": total_fare,
        "collected_at": collected_at.isoformat(),
        "status": status,
        "is_outlier": is_outlier,
    }


def test_period_of_daily():
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    assert period_of(dt, "daily") == "2026-08-24"


def test_period_of_weekly():
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    iso_year, iso_week, _ = dt.isocalendar()
    assert period_of(dt, "weekly") == f"{iso_year}-W{iso_week:02d}"


def test_period_of_monthly():
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    assert period_of(dt, "monthly") == "2026-08"


def test_period_of_rejects_unknown_frequency():
    with pytest.raises(ValueError):
        period_of(datetime(2026, 8, 24, tzinfo=timezone.utc), "yearly")


def test_representative_prices_averages_across_windows_and_classes():
    collected_at = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, collected_at),
        _record("DEL", "BOM", 7000.0, collected_at),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6500.0


def test_representative_prices_excludes_outliers():
    collected_at = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, collected_at),
        _record("DEL", "BOM", 999999.0, collected_at, is_outlier=True),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6000.0


def test_representative_prices_excludes_no_flight_records():
    collected_at = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, collected_at),
        _record("DEL", "BOM", None, collected_at, status="no_flight"),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6000.0


def test_representative_prices_separates_different_routes_and_periods():
    day1 = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    day2 = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc)
    records = [
        _record("DEL", "BOM", 6000.0, day1),
        _record("DEL", "BLR", 7000.0, day1),
        _record("DEL", "BOM", 6600.0, day2),
    ]

    prices = representative_prices(records, "daily")

    assert prices[("DEL-BOM", "2026-08-24")] == 6000.0
    assert prices[("DEL-BLR", "2026-08-24")] == 7000.0
    assert prices[("DEL-BOM", "2026-08-25")] == 6600.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_aggregate.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'index.aggregate'`

- [ ] **Step 3: Write `index/aggregate.py`**

```python
"""Representative price per (route, period), excluding flagged outliers.

This is where Phase 2's deliberate "flag, don't delete" choice gets acted
on: is_outlier=True records are excluded from the average here, which is
the actual point of flagging rather than deleting them (Phase 2's own
design spec: "Phase 3's decision, not Phase 2's").

Averages across every advance-purchase window, fare class, and itinerary
type (nonstop and connecting alike) collected for a route within a period
-- consistent with keeping every itinerary type rather than filtering to
nonstop-only (see the fare-decomposition upgrade's design spec).
"""
from __future__ import annotations

from datetime import datetime

from index.weights import route_key

VALID_FREQUENCIES = {"daily", "weekly", "monthly"}


def period_of(collected_at: datetime, frequency: str) -> str:
    if frequency == "daily":
        return collected_at.date().isoformat()
    if frequency == "weekly":
        iso_year, iso_week, _ = collected_at.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if frequency == "monthly":
        return f"{collected_at.year:04d}-{collected_at.month:02d}"
    raise ValueError(f"unknown frequency: {frequency!r}")


def representative_prices(cleaned_records: list[dict], frequency: str) -> dict[tuple[str, str], float]:
    buckets: dict[tuple[str, str], list[float]] = {}
    for record in cleaned_records:
        if record["status"] != "available" or record["is_outlier"]:
            continue
        route = route_key(record["origin"], record["destination"])
        collected_at = datetime.fromisoformat(record["collected_at"])
        period = period_of(collected_at, frequency)
        buckets.setdefault((route, period), []).append(record["total_fare"])

    return {key: sum(values) / len(values) for key, values in buckets.items()}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_aggregate.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (68 tests: 60 from Task 2 + 8 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add index/aggregate.py tests/test_index_aggregate.py
git commit -m "feat: representative price per route/period, excluding flagged outliers"
```

---

### Task 4: Index-series orchestrator

**Files:**
- Create: `index/build.py`
- Create: `tests/test_index_build.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_index_build.py
import json
from datetime import datetime, timezone

import pytest

from index.build import build_and_write_series, build_series, load_all_cleaned_records

DAY1 = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
DAY2 = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc)
WEIGHTS = {"DEL-BOM": 0.4331, "DEL-BLR": 0.3061, "BOM-BLR": 0.2608}


def _record(origin, destination, total_fare, collected_at, status="available", is_outlier=False):
    return {
        "origin": origin,
        "destination": destination,
        "total_fare": total_fare,
        "collected_at": collected_at.isoformat(),
        "status": status,
        "is_outlier": is_outlier,
    }


def test_build_series_first_period_is_its_own_base():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("DEL", "BLR", 7000.0, DAY1),
        _record("BOM", "BLR", 5000.0, DAY1),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert len(series) == 1
    assert series[0]["period"] == "2026-08-24"
    assert series[0]["base_period"] == "2026-08-24"
    assert series[0]["simple_relative"] == pytest.approx(100.0)
    assert series[0]["laspeyres"] == pytest.approx(100.0)


def test_build_series_computes_a_real_second_point():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("DEL", "BLR", 7000.0, DAY1),
        _record("BOM", "BLR", 5000.0, DAY1),
        _record("DEL", "BOM", 6600.0, DAY2),
        _record("DEL", "BLR", 7000.0, DAY2),
        _record("BOM", "BLR", 5500.0, DAY2),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert [point["period"] for point in series] == ["2026-08-24", "2026-08-25"]
    day2_point = series[1]
    assert day2_point["base_period"] == "2026-08-24"
    assert day2_point["simple_relative"] == pytest.approx(106.66666666666667)
    assert day2_point["laspeyres"] == pytest.approx(106.939)
    assert day2_point["laspeyres"] == day2_point["paasche"]
    assert day2_point["fisher"] == pytest.approx(day2_point["laspeyres"])


def test_build_series_falls_back_to_simple_relative_when_a_route_has_no_weight():
    records = [
        _record("DEL", "BOM", 6000.0, DAY1),
        _record("XXX", "YYY", 1000.0, DAY1),
        _record("DEL", "BOM", 6600.0, DAY2),
        _record("XXX", "YYY", 1000.0, DAY2),
    ]

    series = build_series(records, "daily", WEIGHTS)

    assert "laspeyres" not in series[1]
    assert series[1]["simple_relative"] == pytest.approx(105.0)


def test_build_series_returns_empty_list_for_no_data():
    assert build_series([], "daily", WEIGHTS) == []


def test_load_all_cleaned_records_reads_every_file(tmp_path):
    file1 = tmp_path / "run1.jsonl"
    file2 = tmp_path / "run2.jsonl"
    file1.write_text(json.dumps(_record("DEL", "BOM", 6000.0, DAY1)) + "\n")
    file2.write_text(json.dumps(_record("DEL", "BOM", 6600.0, DAY2)) + "\n")

    records = load_all_cleaned_records(cleaned_base_dir=tmp_path)

    assert len(records) == 2


def test_build_and_write_series_writes_a_versioned_snapshot(tmp_path):
    cleaned_dir = tmp_path / "cleaned"
    index_dir = tmp_path / "index"
    cleaned_dir.mkdir()
    lines = [
        json.dumps(_record("DEL", "BOM", 6000.0, DAY1)),
        json.dumps(_record("DEL", "BLR", 7000.0, DAY1)),
        json.dumps(_record("BOM", "BLR", 5000.0, DAY1)),
    ]
    (cleaned_dir / "run1.jsonl").write_text("\n".join(lines) + "\n")

    out_path = build_and_write_series(
        frequency="daily", cleaned_base_dir=cleaned_dir, index_base_dir=index_dir, weights=WEIGHTS
    )

    assert out_path.parent == index_dir
    result = json.loads(out_path.read_text())
    assert result["frequency"] == "daily"
    assert len(result["series"]) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_build.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'index.build'`

- [ ] **Step 3: Write `index/build.py`**

```python
"""Index-series orchestrator (PRD §4.3): bucket every available cleaned
record into periods, treat the earliest period as the base, compute every
later period's index value relative to it, write a versioned snapshot
(F-3.5). build_series is a pure function -- fully testable with synthetic
multi-period fixtures before enough real days exist to show it for real.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from index.aggregate import representative_prices
from index.formulas import fisher, laspeyres, paasche, simple_relative
from index.weights import load_weights

CLEANED_BASE_DIR = Path("data/cleaned")
INDEX_BASE_DIR = Path("data/index")


def load_all_cleaned_records(cleaned_base_dir: Path = CLEANED_BASE_DIR) -> list[dict]:
    records = []
    for path in sorted(cleaned_base_dir.glob("*.jsonl")):
        with path.open(encoding="utf-8") as f:
            for line in f:
                records.append(json.loads(line))
    return records


def build_series(records: list[dict], frequency: str, weights: dict[str, float]) -> list[dict]:
    prices_by_period = representative_prices(records, frequency)
    periods = sorted({period for (_route, period) in prices_by_period})
    if not periods:
        return []

    base_period = periods[0]
    base_prices = {
        route: price for (route, period), price in prices_by_period.items() if period == base_period
    }

    series = []
    for period in periods:
        period_prices = {
            route: price for (route, p), price in prices_by_period.items() if p == period
        }
        common_routes = sorted(set(base_prices) & set(period_prices))
        if not common_routes:
            continue

        b = {route: base_prices[route] for route in common_routes}
        c = {route: period_prices[route] for route in common_routes}
        w = {route: weights[route] for route in common_routes if route in weights}

        point = {
            "period": period,
            "base_period": base_period,
            "routes": common_routes,
            "simple_relative": simple_relative(b, c),
        }
        if w and set(w) == set(b):
            l_value = laspeyres(b, c, w)
            p_value = paasche(b, c, w)
            point["laspeyres"] = l_value
            point["paasche"] = p_value
            point["fisher"] = fisher(l_value, p_value)
        series.append(point)

    return series


def build_and_write_series(
    frequency: str = "daily",
    cleaned_base_dir: Path = CLEANED_BASE_DIR,
    index_base_dir: Path = INDEX_BASE_DIR,
    weights: dict[str, float] | None = None,
) -> Path:
    if weights is None:
        weights = load_weights()

    records = load_all_cleaned_records(cleaned_base_dir)
    series = build_series(records, frequency, weights)

    result = {
        "comparison_id": uuid.uuid4().hex,
        "frequency": frequency,
        "series": series,
    }

    index_base_dir.mkdir(parents=True, exist_ok=True)
    out_path = index_base_dir / f"{result['comparison_id']}.json"
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return out_path


if __name__ == "__main__":
    written = build_and_write_series()
    print(f"wrote {written}")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_build.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (74 tests: 68 from Task 3 + 6 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add index/build.py tests/test_index_build.py
git commit -m "feat: index-series orchestrator with versioned output"
```

---

### Task 5: Back-test utility

**Files:**
- Create: `index/backtest.py`
- Create: `tests/test_index_backtest.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_index_backtest.py
import pytest

from index.backtest import mape, pearson_correlation


def test_mape_zero_when_series_match_exactly():
    assert mape([100.0, 105.0, 110.0], [100.0, 105.0, 110.0]) == 0.0


def test_mape_computes_average_percent_error():
    # errors: |100-110|/100=0.10, |100-90|/100=0.10 -> mean 0.10 -> 10%
    assert mape([100.0, 100.0], [110.0, 90.0]) == pytest.approx(10.0)


def test_mape_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        mape([100.0], [100.0, 105.0])


def test_mape_rejects_empty_series():
    with pytest.raises(ValueError):
        mape([], [])


def test_pearson_correlation_is_one_for_perfectly_linear_series():
    assert pearson_correlation([1.0, 2.0, 3.0, 4.0], [10.0, 20.0, 30.0, 40.0]) == pytest.approx(1.0)


def test_pearson_correlation_is_negative_one_for_inverse_series():
    assert pearson_correlation([1.0, 2.0, 3.0, 4.0], [40.0, 30.0, 20.0, 10.0]) == pytest.approx(-1.0)


def test_pearson_correlation_rejects_fewer_than_two_points():
    with pytest.raises(ValueError):
        pearson_correlation([1.0], [1.0])


def test_pearson_correlation_rejects_zero_variance_series():
    with pytest.raises(ValueError):
        pearson_correlation([5.0, 5.0, 5.0], [1.0, 2.0, 3.0])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_index_backtest.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'index.backtest'`

- [ ] **Step 3: Write `index/backtest.py`**

```python
"""Back-test comparison utility (PRD F-3.6): MAPE and correlation between
two aligned time series. Not wired to a live DGCA/CPI feed in this phase
-- see the design spec for why (no 30 days of real APIx history yet, no
way to backfill historical Akasa fares to shortcut it). Correct and
tested now, ready to point at real reference data once both series exist.
"""
from __future__ import annotations

import math


def mape(actual: list[float], predicted: list[float]) -> float:
    if len(actual) != len(predicted):
        raise ValueError("actual and predicted must be the same length")
    if not actual:
        raise ValueError("cannot compute MAPE over an empty series")
    errors = [abs((a - p) / a) for a, p in zip(actual, predicted)]
    return 100.0 * sum(errors) / len(errors)


def pearson_correlation(series_a: list[float], series_b: list[float]) -> float:
    if len(series_a) != len(series_b):
        raise ValueError("series_a and series_b must be the same length")
    n = len(series_a)
    if n < 2:
        raise ValueError("need at least 2 points to compute a correlation")

    mean_a = sum(series_a) / n
    mean_b = sum(series_b) / n
    covariance = sum((a - mean_a) * (b - mean_b) for a, b in zip(series_a, series_b))
    variance_a = sum((a - mean_a) ** 2 for a in series_a)
    variance_b = sum((b - mean_b) ** 2 for b in series_b)
    denominator = math.sqrt(variance_a * variance_b)
    if denominator == 0:
        raise ValueError("cannot compute correlation when one series has zero variance")
    return covariance / denominator
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_index_backtest.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (82 tests: 74 from Task 4 + 8 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add index/backtest.py tests/test_index_backtest.py
git commit -m "feat: MAPE and correlation back-test utility"
```

---

### Task 6: Verify against real data (a genuine second period)

Only one real cleaned run exists right now. This task produces a second one and demonstrates a real, non-trivial index computation end-to-end — not just synthetic fixtures.

**Files:** none created — this is a verification-only task using the CLI entrypoints already built in Phases 1-2 and this phase.

- [ ] **Step 1: Run the scraper again to get a second real raw run**

Run: `python -m scraper.run`
Expected: a new file appears under `data/raw/akasaair/<new_run_id>.jsonl`

- [ ] **Step 2: Clean the new run**

Run:
```bash
python3 -c "
from pipeline.clean import clean_run
import pathlib
run_id = sorted(pathlib.Path('data/raw/akasaair').glob('*.jsonl'), key=lambda p: p.stat().st_mtime)[-1].stem
out = clean_run(run_id)
print('cleaned', out)
"
```
Expected: a new file appears under `data/cleaned/<new_run_id>.jsonl`

- [ ] **Step 3: Build the index series against everything now available**

Run: `python -m index.build`
Expected: prints `wrote data/index/<comparison_id>.json`

- [ ] **Step 4: Inspect the real output**

```bash
python3 -c "
import json, glob
latest = sorted(glob.glob('data/index/*.json'))[-1]
result = json.load(open(latest))
print('frequency:', result['frequency'])
for point in result['series']:
    print(point['period'], 'routes=', point['routes'],
          'simple_relative=', round(point.get('simple_relative', 0), 2),
          'laspeyres=', round(point.get('laspeyres', -1), 2) if 'laspeyres' in point else 'n/a')
"
```

Expected: at least 2 periods in the series (today's original run(s) plus the new one just triggered, both likely landing on the same calendar day since they're minutes apart — if so, note that a genuine cross-day comparison still needs the scheduled cron to actually run tomorrow, and record that observation rather than forcing a fake second day). Report the real numbers you see, whatever they are — don't round them into looking more meaningful than the data supports.

- [ ] **Step 5: If the report from Step 4 shows only one period (both runs landed the same calendar day)**

That's expected and fine — `period_of` buckets by calendar day, and two runs minutes apart on the same day correctly collapse into one period's average (this is `representative_prices` doing exactly what it's supposed to: averaging multiple observations within a period, not artificially forcing daily granularity onto sub-daily data). State this plainly in the report rather than treating it as a failure: the mechanism is proven correct with the synthetic multi-period tests in Task 4; a genuine multi-day series requires the scheduled daily cron to actually run on separate calendar days.

- [ ] **Step 6: No commit for this task** — its purpose is verification and a written report, not new code. If Steps 1-4 surface a real bug, fix it as a new, separate commit and re-run this task's steps from the top.

---

## Definition of done

- `pytest -v` passes with 82 tests, zero live network calls (this phase never touches the network — pure computation over already-collected/cleaned data; the network call in Task 6 Step 1 goes through the existing, already-reviewed `scraper.run`, not new code in this plan).
- `ruff check .` passes clean.
- `config/weights.json` holds real, attributed DGCA data, not placeholders.
- `python -m index.build` runs against real data on disk and writes a versioned `data/index/<comparison_id>.json`.
- The report from Task 6 states plainly what the real data showed — including if it's only a single-period result, and why.
