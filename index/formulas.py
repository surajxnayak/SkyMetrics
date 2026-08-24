"""Index formulas (PRD F-3.2): simple relative, Laspeyres, Paasche, Fisher.

Laspeyres is the weighted ARITHMETIC mean of price relatives using base-
period weights. Paasche is the weighted HARMONIC mean of price relatives
using current-period weights -- this is not a stylistic choice, it's the
standard index-number-theory result (see any CPI methodology manual).
Because arithmetic mean >= harmonic mean always (equality only when every
price relative is identical), Laspeyres and Paasche will only coincide in
that degenerate case -- not simply because they're given the same weights
dict. With only one static weight source right now (see weights.py),
Paasche's current-period weights are numerically identical to Laspeyres'
base-period weights, but the two formulas still diverge because they're
different kinds of mean over the same relatives.
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
        current_weights[route] * base_prices[route] / current_prices[route] for route in base_prices
    )
    return 100.0 * sum(current_weights.values()) / weighted_sum


def fisher(laspeyres_value: float, paasche_value: float) -> float:
    return math.sqrt(laspeyres_value * paasche_value)
