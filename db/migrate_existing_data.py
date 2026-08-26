"""One-time backfill: reads the existing real data/cleaned/*.jsonl and
data/index/*.json files and inserts them into Postgres. Run manually, once,
against an empty database -- primary-key conflicts on a second run are
expected and correct (see the design spec's error-handling section), not a
bug to work around.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from psycopg.types.json import Jsonb

from api.db import get_connection
from index.build import CLEANED_BASE_DIR, INDEX_BASE_DIR, load_all_cleaned_records


def fare_quote_row(record: dict) -> dict:
    fee_breakdown = record["fee_breakdown"]
    return {
        "quote_id": record["quote_id"],
        "origin": record["origin"],
        "destination": record["destination"],
        "carrier": record["carrier"],
        "source": record["source"],
        "travel_date": date.fromisoformat(record["travel_date"]),
        "collected_at": datetime.fromisoformat(record["collected_at"]),
        "advance_window": record["advance_window"],
        "fare_class": record["fare_class"],
        "base_fare": record["base_fare"],
        "taxes": record["taxes"],
        "udf": record["udf"],
        "convenience_fee": record["convenience_fee"],
        "total_fare": record["total_fare"],
        "status": record["status"],
        "run_id": record["run_id"],
        "fee_breakdown": Jsonb(fee_breakdown) if fee_breakdown is not None else None,
        "routing": record["routing"],
        "is_outlier": record["is_outlier"],
        "source_quote_ids": record["source_quote_ids"],
    }


def index_point_rows(snapshot: dict) -> list[dict]:
    return [
        {
            "comparison_id": snapshot["comparison_id"],
            "frequency": snapshot["frequency"],
            "period": point["period"],
            "base_period": point["base_period"],
            "routes": point["routes"],
            "simple_relative": point["simple_relative"],
            "laspeyres": point.get("laspeyres"),
            "paasche": point.get("paasche"),
            "fisher": point.get("fisher"),
        }
        for point in snapshot["series"]
    ]


def migrate() -> tuple[int, int]:
    conn = get_connection()
    fare_count = 0
    point_count = 0
    try:
        with conn.cursor() as cur:
            for record in load_all_cleaned_records(CLEANED_BASE_DIR):
                row = fare_quote_row(record)
                cur.execute(
                    """
                    INSERT INTO fare_quotes
                        (quote_id, origin, destination, carrier, source, travel_date,
                         collected_at, advance_window, fare_class, base_fare, taxes, udf,
                         convenience_fee, total_fare, status, run_id, fee_breakdown, routing,
                         is_outlier, source_quote_ids)
                    VALUES
                        (%(quote_id)s, %(origin)s, %(destination)s, %(carrier)s, %(source)s,
                         %(travel_date)s, %(collected_at)s, %(advance_window)s, %(fare_class)s,
                         %(base_fare)s, %(taxes)s, %(udf)s, %(convenience_fee)s, %(total_fare)s,
                         %(status)s, %(run_id)s, %(fee_breakdown)s, %(routing)s, %(is_outlier)s,
                         %(source_quote_ids)s)
                    """,
                    row,
                )
                fare_count += 1

            for path in sorted(INDEX_BASE_DIR.glob("*.json")):
                snapshot = json.loads(path.read_text(encoding="utf-8"))
                for row in index_point_rows(snapshot):
                    cur.execute(
                        """
                        INSERT INTO index_points
                            (comparison_id, frequency, period, base_period, routes,
                             simple_relative, laspeyres, paasche, fisher)
                        VALUES
                            (%(comparison_id)s, %(frequency)s, %(period)s, %(base_period)s,
                             %(routes)s, %(simple_relative)s, %(laspeyres)s, %(paasche)s,
                             %(fisher)s)
                        """,
                        row,
                    )
                    point_count += 1
        conn.commit()
    finally:
        conn.close()
    return fare_count, point_count


if __name__ == "__main__":
    fares, points = migrate()
    print(f"migrated {fares} fare quotes, {points} index points")
