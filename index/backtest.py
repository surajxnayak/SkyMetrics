"""Back-test comparison utility (PRD F-3.6): MAPE and correlation between
two aligned time series. Not wired to a live DGCA/CPI feed in this phase
-- see the design spec for why (no 30 days of real APIx history yet, no
way to backfill historical Akasa fares to shortcut it). Correct and
tested now, ready to point at real reference data once both series exist.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REFERENCE_PATH = Path("config/service_ppi_reference.json")


def load_reference_series(path: Path = REFERENCE_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


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


def aggregate_apix_to_quarters(apix_series: list[dict]) -> dict[tuple[str, str], float]:
    buckets: dict[tuple[str, str], list[float]] = {}
    for point in apix_series:
        quarter_key = fiscal_quarter_of(point["period"])
        buckets.setdefault(quarter_key, []).append(point["simple_relative"])
    return {key: sum(values) / len(values) for key, values in buckets.items()}


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
        apix_curr = apix_quarters[current_key]
        apix_prev = apix_quarters[previous_key]
        apix_growth.append(100.0 * (apix_curr - apix_prev) / apix_prev)

        ref_curr = reference_quarters[current_key]
        ref_prev = reference_quarters[previous_key]
        reference_growth.append(100.0 * (ref_curr - ref_prev) / ref_prev)
    return apix_growth, reference_growth


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
