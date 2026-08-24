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
