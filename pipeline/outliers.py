"""Flag statistically implausible fares within a route/window group (PRD F-2.2).

IQR bounds are computed per (origin, destination, advance_window), across
every routing/fare-class type together -- a connecting itinerary priced
higher than a nonstop on the same route/date is part of the same real
distribution a traveler sees, not a special case to exempt.

# ponytail: groups smaller than 6 are excluded because, with this exact
# method (statistics.quantiles exclusive + 1.5*IQR), a 4- or 5-point group
# can never produce a flag regardless of how extreme its values are -- this
# isn't a "small samples are noisy" heuristic, it's a mathematical property
# of this specific formula. Revisit the method (not just the threshold) if
# a route/window group realistically lands at exactly 4-5 quotes and outlier
# detection needs to actually fire there.
"""
from __future__ import annotations

import statistics

from scraper.schema import FareQuote

MIN_GROUP_SIZE_FOR_QUARTILES = 6


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
