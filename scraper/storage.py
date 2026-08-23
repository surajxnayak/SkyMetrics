"""JSONL raw-quote writer with provenance (PRD §6.2)."""
from __future__ import annotations

import json
from pathlib import Path

from scraper.schema import FareQuote

DEFAULT_BASE_DIR = Path("data/raw")


def write_quotes(
    quotes: list[FareQuote], source: str, run_id: str, base_dir: Path = DEFAULT_BASE_DIR
) -> Path:
    out_dir = base_dir / source
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{run_id}.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for quote in quotes:
            f.write(json.dumps(quote.to_json_dict()) + "\n")
    return out_path
