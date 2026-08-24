"""Cleaned fare record: a raw FareQuote plus cleaning-stage metadata (PRD §4.2).

Composes a FareQuote rather than re-declaring its 18 fields, to avoid the
copy-paste-bug risk of keeping two parallel field lists in sync.
"""
from __future__ import annotations

from dataclasses import dataclass

from scraper.schema import FareQuote


@dataclass(frozen=True)
class CleanedFareQuote:
    quote: FareQuote
    is_outlier: bool
    source_quote_ids: list[str]

    def to_json_dict(self) -> dict:
        d = self.quote.to_json_dict()
        d["is_outlier"] = self.is_outlier
        d["source_quote_ids"] = self.source_quote_ids
        return d
