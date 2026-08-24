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
