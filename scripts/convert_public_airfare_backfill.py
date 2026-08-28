"""Convert public historical airfare CSV files into SkyMetrics raw JSONL.

Input source:
https://github.com/Avij112/flight-fare-analysis/blob/main/datasets.zip

The public files include flight date and listed fare, but not the original
collection timestamp or advance-purchase window. For pipeline compatibility,
this backfill sets collected_at to noon UTC on the flight date and uses T+7 as
a documented placeholder advance window.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path


CITY_TO_AIRPORT = {
    "Bangalore": "BLR",
    "Banglore": "BLR",
    "Delhi": "DEL",
    "Mumbai": "BOM",
}

BASKET_ROUTES = {("DEL", "BOM"), ("DEL", "BLR"), ("BOM", "BLR")}

FILES = (
    ("datasets/economy.xls", "historical_public_airfare_2022"),
    ("datasets/goibibo_flights_data.xls", "goibibo_historical_2023"),
)


def _parse_price(value: str) -> float:
    return float(value.replace(",", "").strip())


def _parse_date(value: str) -> str:
    parsed = datetime.strptime(value.strip(), "%d-%m-%Y")
    return parsed.date().isoformat()


def _carrier(row: dict[str, str]) -> str:
    if row.get("ch_code"):
        return row["ch_code"].strip()
    flight_num = row.get("flight_num", "").strip()
    if "-" in flight_num:
        return flight_num.split("-", 1)[0].strip()
    return row.get("airline", "").strip()


def _routing(row: dict[str, str]) -> str:
    parts = [
        row.get("flight_num") or row.get("num_code"),
        row.get("stops") or row.get("stop"),
        f"{row.get('dep_time', '')}-{row.get('arr_time', '')}",
    ]
    return "|".join(part.strip() for part in parts if part and part.strip())


def _record(row: dict[str, str], source: str, run_id: str) -> dict | None:
    origin = CITY_TO_AIRPORT.get(row.get("from", "").strip())
    destination = CITY_TO_AIRPORT.get(row.get("to", "").strip())
    if not origin or not destination or (origin, destination) not in BASKET_ROUTES:
        return None

    travel_date = _parse_date(row.get("date") or row.get("flight date") or "")
    collected_at = f"{travel_date}T12:00:00+00:00"

    return {
        "quote_id": str(uuid.uuid4()),
        "origin": origin,
        "destination": destination,
        "carrier": _carrier(row),
        "source": source,
        "travel_date": travel_date,
        "collected_at": collected_at,
        "advance_window": "T+7",
        "fare_class": row.get("class", "economy").strip() or "economy",
        "base_fare": None,
        "taxes": None,
        "udf": None,
        "convenience_fee": None,
        "total_fare": _parse_price(row["price"]),
        "status": "available",
        "run_id": run_id,
        "fee_breakdown": None,
        "routing": _routing(row),
    }


def convert(zip_path: Path, output_dir: Path, run_id: str) -> list[Path]:
    output_paths = []
    with zipfile.ZipFile(zip_path) as archive:
        for member_name, source in FILES:
            text = archive.read(member_name).decode("utf-8-sig")
            rows = csv.DictReader(io.StringIO(text))
            source_dir = output_dir / source
            source_dir.mkdir(parents=True, exist_ok=True)
            output_path = source_dir / f"{run_id}.jsonl"
            count = 0
            with output_path.open("w", encoding="utf-8") as handle:
                for row in rows:
                    record = _record(row, source, run_id)
                    if record is None:
                        continue
                    handle.write(json.dumps(record, separators=(",", ":")) + "\n")
                    count += 1
            print(f"{output_path}: {count} records")
            output_paths.append(output_path)
    return output_paths


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--run-id", default="historical-public-airfare-backfill")
    args = parser.parse_args()
    convert(args.zip_path, args.output_dir, args.run_id)


if __name__ == "__main__":
    main()
