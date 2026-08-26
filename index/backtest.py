"""Back-test comparison utility (PRD F-3.6): MAPE and correlation between
two aligned time series, wired to a real government reference series (the
Service PPI's Air (Passenger) Service Price Index -- see
config/service_ppi_reference.json and load_reference_series()) via
run_backtest(). Comparisons run on period-over-period growth rates, not raw
levels, since the two series have different base periods.
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
    # Real quarter-over-quarter growth rates reach here via division (not
    # literal constants), so a functionally-constant series lands a few ULPs
    # off exact zero (e.g. 9.47e-30) rather than == 0.0, letting a
    # meaningless correlation silently through. Tolerance, not exact
    # equality, is what actually catches degenerate real data.
    if math.isclose(denominator, 0.0, abs_tol=1e-9):
        raise ValueError("cannot compute correlation when one series has zero variance")
    return covariance / denominator


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
