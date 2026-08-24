"""Cleaning orchestrator: load one run's raw quotes across every source,
dedup, flag outliers, write cleaned JSONL (PRD §4.2)."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from pipeline.dedup import dedup_quotes
from pipeline.outliers import flag_outliers
from pipeline.schema import CleanedFareQuote
from scraper.schema import FareQuote

RAW_BASE_DIR = Path("data/raw")
CLEANED_BASE_DIR = Path("data/cleaned")


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
