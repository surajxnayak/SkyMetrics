"""Flag statistically implausible fares within a route/window group (PRD F-2.2).

IQR bounds are computed per (origin, destination, advance_window), across
every routing/fare-class type together -- a connecting itinerary priced
higher than a nonstop on the same route/date is part of the same real
distribution a traveler sees, not a special case to exempt.

# ponytail: small-sample IQR is statistically noisy with only a handful of
# fares per group (this basket has 3 routes x 5 windows); acceptable for
# this prototype's scope, revisit if a larger basket makes it matter.
"""
from __future__ import annotations

import statistics

from scraper.schema import FareQuote

MIN_GROUP_SIZE_FOR_QUARTILES = 4


def flag_outliers(quotes: list[FareQuote]) -> dict[str, bool]:
    groups: dict[tuple, list[FareQuote]] = {}
    for quote in quotes:
        if quote.status != "available" or quote.total_fare is None:
            continue
        key = (quote.origin, quote.destination, quote.advance_window)
        groups.setdefault(key, []).append(quote)

    flags: dict[str, bool] = {quote.quote_id: False for quote in quotes}

    for group in groups.values():
        if len(group) < MIN_GROUP_SIZE_FOR_QUARTILES:
            continue
        fares = sorted(q.total_fare for q in group)
        q1, _, q3 = statistics.quantiles(fares, n=4)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        for quote in group:
            flags[quote.quote_id] = not (lower <= quote.total_fare <= upper)

    return flags
