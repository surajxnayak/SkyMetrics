"""Common interface every source scraper implements."""
from __future__ import annotations

from abc import ABC, abstractmethod

from scraper.schema import FareQuote


class BaseScraper(ABC):
    source_name: str
    carrier_code: str

    @abstractmethod
    def fetch_quotes(self, origin: str, destination: str, run_id: str) -> list[FareQuote]:
        """Fetch fare quotes for every configured advance-purchase window."""
