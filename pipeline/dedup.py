"""De-duplicate fare quotes collected within one run (PRD F-2.4).

Keyed on carrier, not source: the goal is collapsing the same underlying
fare observed redundantly through different collection paths (e.g. an
airline-direct source and an OTA reselling that airline's inventory
reporting the identical flight) -- not collapsing two different airlines
that happen to charge the same price. Dedup operates within one run only;
different days are genuinely different price observations, not duplicates.
"""
from __future__ import annotations

from scraper.schema import FareQuote


def _dedup_key(quote: FareQuote) -> tuple:
    return (
        quote.carrier,
        quote.origin,
        quote.destination,
        quote.travel_date,
        quote.advance_window,
        quote.fare_class,
        quote.routing,
        quote.total_fare,
    )


def dedup_quotes(quotes: list[FareQuote]) -> list[tuple[FareQuote, list[str]]]:
    groups: dict[tuple, list[FareQuote]] = {}
    for quote in quotes:
        groups.setdefault(_dedup_key(quote), []).append(quote)

    return [(group[0], [q.quote_id for q in group]) for group in groups.values()]
