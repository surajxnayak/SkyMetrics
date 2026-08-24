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
