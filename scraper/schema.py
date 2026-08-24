"""Fare-record schema shared by all scrapers (PRD §6.2)."""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Optional

ADVANCE_WINDOWS: dict[str, int] = {
    "T+1": 1,
    "T+7": 7,
    "T+15": 15,
    "T+30": 30,
    "T+45": 45,
}

VALID_STATUSES = {"available", "sold_out", "cancelled", "no_flight"}


@dataclass(frozen=True)
class FareQuote:
    quote_id: str
    origin: str
    destination: str
    carrier: str
    source: str
    travel_date: date
    collected_at: datetime
    advance_window: str
    fare_class: Optional[str]
    base_fare: Optional[float]
    taxes: Optional[float]
    udf: Optional[float]
    convenience_fee: Optional[float]
    total_fare: Optional[float]
    status: str
    run_id: str
    fee_breakdown: Optional[dict[str, float]] = None
    routing: Optional[str] = None

    def __post_init__(self):
        if self.advance_window not in ADVANCE_WINDOWS:
            raise ValueError(f"invalid advance_window: {self.advance_window!r}")
        if self.status not in VALID_STATUSES:
            raise ValueError(f"invalid status: {self.status!r}")

    def to_json_dict(self) -> dict:
        d = asdict(self)
        d["travel_date"] = self.travel_date.isoformat()
        d["collected_at"] = self.collected_at.isoformat()
        return d


def new_quote_id() -> str:
    return str(uuid.uuid4())
