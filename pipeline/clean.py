"""Cleaning orchestrator: load one run's raw quotes across every source,
dedup, flag outliers, write cleaned JSONL (PRD §4.2)."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from psycopg.types.json import Jsonb

from pipeline.dedup import dedup_quotes
from pipeline.outliers import flag_outliers
from pipeline.schema import CleanedFareQuote
from scraper.schema import FareQuote

RAW_BASE_DIR = Path("data/raw")
CLEANED_BASE_DIR = Path("data/cleaned")


# ponytail: a malformed raw record (bad JSON, missing/renamed field) raises
# uncaught here and aborts the whole load -- acceptable since raw JSONL is
# only ever produced by scraper/storage.py's write_quotes from a validated
# FareQuote, not external/untrusted input; revisit if that assumption stops
# holding (e.g. raw files ever get hand-edited or come from another tool).
def _quote_from_dict(record: dict) -> FareQuote:
    record = dict(record)
    record["travel_date"] = date.fromisoformat(record["travel_date"])
    record["collected_at"] = datetime.fromisoformat(record["collected_at"])
    return FareQuote(**record)


def load_run_quotes(run_id: str, raw_base_dir: Path = RAW_BASE_DIR) -> list[FareQuote]:
    quotes = []
    for source_dir in sorted(raw_base_dir.glob("*")):
        raw_file = source_dir / f"{run_id}.jsonl"
        if not raw_file.exists():
            continue
        with raw_file.open(encoding="utf-8") as f:
            for line in f:
                quotes.append(_quote_from_dict(json.loads(line)))
    return quotes


def clean_run(
    run_id: str,
    raw_base_dir: Path = RAW_BASE_DIR,
    cleaned_base_dir: Path = CLEANED_BASE_DIR,
) -> Path:
    quotes = load_run_quotes(run_id, raw_base_dir)
    deduped = dedup_quotes(quotes)
    representative_quotes = [quote for quote, _ in deduped]
    outlier_flags = flag_outliers(representative_quotes)

    cleaned_quotes = [
        CleanedFareQuote(
            quote=quote,
            is_outlier=outlier_flags[quote.quote_id],
            source_quote_ids=source_quote_ids,
        )
        for quote, source_quote_ids in deduped
    ]

    cleaned_base_dir.mkdir(parents=True, exist_ok=True)
    out_path = cleaned_base_dir / f"{run_id}.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for cleaned in cleaned_quotes:
            f.write(json.dumps(cleaned.to_json_dict()) + "\n")
    return out_path


def clean_run_to_db(run_id: str, conn, raw_base_dir: Path = RAW_BASE_DIR) -> int:
    quotes = load_run_quotes(run_id, raw_base_dir)
    deduped = dedup_quotes(quotes)
    representative_quotes = [quote for quote, _ in deduped]
    outlier_flags = flag_outliers(representative_quotes)

    with conn.cursor() as cur:
        for quote, source_quote_ids in deduped:
            cur.execute(
                """
                INSERT INTO fare_quotes
                    (quote_id, origin, destination, carrier, source, travel_date, collected_at,
                     advance_window, fare_class, base_fare, taxes, udf, convenience_fee,
                     total_fare, status, run_id, fee_breakdown, routing, is_outlier,
                     source_quote_ids)
                VALUES
                    (%(quote_id)s, %(origin)s, %(destination)s, %(carrier)s, %(source)s,
                     %(travel_date)s, %(collected_at)s, %(advance_window)s, %(fare_class)s,
                     %(base_fare)s, %(taxes)s, %(udf)s, %(convenience_fee)s, %(total_fare)s,
                     %(status)s, %(run_id)s, %(fee_breakdown)s, %(routing)s, %(is_outlier)s,
                     %(source_quote_ids)s)
                """,
                {
                    "quote_id": quote.quote_id,
                    "origin": quote.origin,
                    "destination": quote.destination,
                    "carrier": quote.carrier,
                    "source": quote.source,
                    "travel_date": quote.travel_date,
                    "collected_at": quote.collected_at,
                    "advance_window": quote.advance_window,
                    "fare_class": quote.fare_class,
                    "base_fare": quote.base_fare,
                    "taxes": quote.taxes,
                    "udf": quote.udf,
                    "convenience_fee": quote.convenience_fee,
                    "total_fare": quote.total_fare,
                    "status": quote.status,
                    "run_id": quote.run_id,
                    "fee_breakdown": (
                        Jsonb(quote.fee_breakdown) if quote.fee_breakdown is not None else None
                    ),
                    "routing": quote.routing,
                    "is_outlier": outlier_flags[quote.quote_id],
                    "source_quote_ids": source_quote_ids,
                },
            )
    conn.commit()
    return len(deduped)
