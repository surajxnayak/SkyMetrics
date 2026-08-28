from __future__ import annotations

import json
import math
import os
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import psycopg


RUN_ID = "demo-dashboard-default-2026-08-28"
INDEX_COMPARISON_ID = "abcdef1234567890abcdef1234567890"
MAP_SNAPSHOT_ID = "demo-map-dashboard-2026-08-28"
ROUTES = (
    ("DEL", "BOM", 6850),
    ("DEL", "BLR", 7850),
    ("BOM", "BLR", 7350),
)
WINDOWS = (("T+45", 45), ("T+30", 30), ("T+15", 15), ("T+7", 7), ("T+1", 1))
FARE_CLASSES = ("T3", "U1")


def load_env() -> None:
    root = Path(__file__).resolve().parents[2]
    env_file = root / ".env"
    if not env_file.exists():
      return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def rows_for_fares() -> list[tuple]:
    today = date(2026, 8, 28)
    start = today - timedelta(days=41)
    rows: list[tuple] = []
    for day_index in range(42):
        collected_date = start + timedelta(days=day_index)
        collected_at = datetime.combine(
            collected_date,
            time(hour=7 + day_index % 4, minute=14 + day_index % 7, tzinfo=timezone.utc),
        )
        day_wave = math.sin(day_index / 4.8) * 240
        weekend_lift = 360 if collected_date.weekday() in (4, 5, 6) else 0
        for route_index, (origin, destination, route_base) in enumerate(ROUTES):
            route_wave = math.cos((day_index + route_index) / 5.2) * 180
            for window, lead_days in WINDOWS:
                urgency = {"T+45": -780, "T+30": -520, "T+15": -140, "T+7": 420, "T+1": 1180}[window]
                travel_date = collected_date + timedelta(days=lead_days)
                for class_index, fare_class in enumerate(FARE_CLASSES):
                    class_lift = 0 if fare_class == "T3" else 310
                    total = route_base + day_wave + route_wave + weekend_lift + urgency + class_lift
                    total += ((day_index * 37 + route_index * 71 + class_index * 83) % 260) - 90
                    total = max(3200, round(total / 10) * 10)
                    status = "available"
                    is_outlier = False
                    if (day_index + route_index + class_index) % 53 == 0:
                        status = "no_flight"
                        total_value = None
                        base_fare = taxes = udf = convenience_fee = None
                    else:
                        if (day_index * 3 + route_index + class_index) % 97 == 0:
                            is_outlier = True
                            total += 3400
                        total_value = total
                        taxes = 728
                        udf = 62
                        convenience_fee = 199
                        base_fare = total_value - taxes - udf - convenience_fee
                    route = f"{origin}-{destination}"
                    quote_id = f"{RUN_ID}-{collected_date.isoformat()}-{route}-{window}-{fare_class}"
                    rows.append(
                        (
                            quote_id,
                            origin,
                            destination,
                            "QP",
                            "akasaair",
                            travel_date,
                            collected_at,
                            window,
                            fare_class,
                            base_fare,
                            taxes,
                            udf,
                            convenience_fee,
                            total_value,
                            status,
                            RUN_ID,
                            json.dumps(
                                {
                                    "base": base_fare,
                                    "taxes": taxes,
                                    "udf": udf,
                                    "convenience_fee": convenience_fee,
                                }
                            ),
                            route,
                            is_outlier,
                            [quote_id],
                        )
                    )
    return rows


def rows_for_index() -> list[tuple]:
    today = date(2026, 8, 28)
    start = today - timedelta(days=41)
    rows: list[tuple] = []
    for day_index in range(42):
        period = start + timedelta(days=day_index)
        relative = 100 + math.sin(day_index / 5.0) * 5.7 + day_index * 0.16
        rows.append(
            (
                INDEX_COMPARISON_ID,
                "daily",
                period.isoformat(),
                start.isoformat(),
                ["DEL-BOM", "DEL-BLR", "BOM-BLR"],
                round(relative, 4),
                round(relative * 0.992, 4),
                round(relative * 1.006, 4),
                round(relative * 0.999, 4),
                datetime(2026, 8, 28, 8, 0, tzinfo=timezone.utc),
            )
        )
    return rows


def seed(conn: psycopg.Connection) -> None:
    fare_rows = rows_for_fares()
    index_rows = rows_for_index()
    city_rows = [
        ("DEL", "Delhi", 28.5562, 77.1, ["DEL"], True, json.dumps({"tier": "metro"})),
        ("BOM", "Mumbai", 19.0896, 72.8656, ["BOM"], True, json.dumps({"tier": "metro"})),
        ("BLR", "Bengaluru", 13.1986, 77.7066, ["BLR"], True, json.dumps({"tier": "metro"})),
        ("MAA", "Chennai", 12.9941, 80.1709, ["MAA"], True, json.dumps({"tier": "metro"})),
        ("HYD", "Hyderabad", 17.2403, 78.4294, ["HYD"], True, json.dumps({"tier": "metro"})),
        ("CCU", "Kolkata", 22.6547, 88.4467, ["CCU"], True, json.dumps({"tier": "metro"})),
    ]
    edge_rows = [
        (MAP_SNAPSHOT_ID, "daily", "2026-08-28", "2026-07-18", "DEL", "BOM", "DEL-BOM", 106.4, 168, 165, 3, 1),
        (MAP_SNAPSHOT_ID, "daily", "2026-08-28", "2026-07-18", "BOM", "DEL", "BOM-DEL", 104.8, 162, 160, 2, 1),
        (MAP_SNAPSHOT_ID, "daily", "2026-08-28", "2026-07-18", "DEL", "BLR", "DEL-BLR", 111.7, 170, 168, 2, 1),
        (MAP_SNAPSHOT_ID, "daily", "2026-08-28", "2026-07-18", "BLR", "DEL", "BLR-DEL", 109.5, 166, 164, 2, 1),
        (MAP_SNAPSHOT_ID, "daily", "2026-08-28", "2026-07-18", "BOM", "BLR", "BOM-BLR", 103.2, 164, 162, 2, 1),
        (MAP_SNAPSHOT_ID, "daily", "2026-08-28", "2026-07-18", "BLR", "BOM", "BLR-BOM", 101.9, 158, 156, 2, 1),
    ]
    with conn.cursor() as cur:
        cur.execute("DELETE FROM fare_quotes WHERE run_id = %s", (RUN_ID,))
        cur.execute("DELETE FROM index_points WHERE comparison_id = %s", (INDEX_COMPARISON_ID,))
        cur.execute("DELETE FROM map_route_cpi_edges WHERE snapshot_id = %s", (MAP_SNAPSHOT_ID,))
        cur.executemany(
            """
            INSERT INTO fare_quotes (
                quote_id, origin, destination, carrier, source, travel_date, collected_at,
                advance_window, fare_class, base_fare, taxes, udf, convenience_fee, total_fare,
                status, run_id, fee_breakdown, routing, is_outlier, source_quote_ids
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s
            )
            """,
            fare_rows,
        )
        cur.executemany(
            """
            INSERT INTO index_points (
                comparison_id, frequency, period, base_period, routes, simple_relative,
                laspeyres, paasche, fisher, written_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            index_rows,
        )
        cur.executemany(
            """
            INSERT INTO map_city_nodes (
                city_code, city_name, latitude, longitude, airport_codes, is_active, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (city_code) DO UPDATE SET
                city_name = EXCLUDED.city_name,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                airport_codes = EXCLUDED.airport_codes,
                is_active = EXCLUDED.is_active,
                metadata = EXCLUDED.metadata
            """,
            city_rows,
        )
        cur.executemany(
            """
            INSERT INTO map_route_cpi_edges (
                snapshot_id, frequency, period, base_period, origin_city_code, destination_city_code,
                route_key, cpi, quote_count, available_count, no_flight_count, source_count
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            edge_rows,
        )
    conn.commit()
    print(
        f"Seeded {len(fare_rows)} fare rows, {len(index_rows)} index rows, "
        f"{len(city_rows)} city nodes, and {len(edge_rows)} map edges."
    )


def main() -> None:
    load_env()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set and was not found in the parent .env file.")
    with psycopg.connect(database_url) as conn:
        seed(conn)


if __name__ == "__main__":
    main()
