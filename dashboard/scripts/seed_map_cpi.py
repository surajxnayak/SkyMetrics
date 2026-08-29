"""Create and load the local 15-edge map CPI fixture.

The reference values are the latest official MoSPI May 2026 urban/state CPI
indices (base 2024=100). Route CPI values are deterministic dashboard dummy
values derived from those references and are intentionally marked as dummy.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "dashboard"
PAYLOAD = DASHBOARD / "scripts" / "map_cpi_seed.json"
SNAPSHOT_ID = "local-dashboard-map-cpi-2026-08-29"
PERIOD = "2026-05-01"
BASE_PERIOD = "2025-05-01"

# MoSPI Annexure III, May 2026 (provisional), urban CPI, base 2024=100.
CITY_CPI = {
    "DEL": 103.90, "BOM": 105.19, "BLR": 106.69, "MAA": 106.96,
    "HYD": 108.51, "CCU": 104.80, "AMD": 104.66, "PNQ": 105.19,
    "GOI": 104.99, "COK": 106.65, "JAI": 105.95, "LKO": 105.58,
    "PAT": 103.79, "GAU": 103.69, "IXC": 105.63, "IDR": 105.76,
}
DISPLAY_CODES = list(CITY_CPI)
EDGE_PAIRS = [
    ("DEL", "GOI"), ("BOM", "GAU"), ("BLR", "LKO"), ("MAA", "IXC"),
    ("HYD", "COK"), ("CCU", "JAI"), ("AMD", "PAT"), ("PNQ", "CCU"),
    ("GOI", "LKO"), ("COK", "IXC"), ("JAI", "HYD"), ("DEL", "CCU"),
    ("BOM", "MAA"), ("BLR", "GOI"), ("AMD", "GAU"),
]
# Deliberately span the CPI legend so the dummy dashboard snapshot exercises
# the green, yellow, and red edge styles.
EDGE_CPI = [
    96.8, 99.6, 101.4, 97.2, 103.4, 100.2, 96.5, 101.2,
    104.4, 99.1, 102.0, 97.8, 100.5, 103.1, 98.6,
]


def load_env() -> None:
    env_path = ROOT / ".env"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip().strip('"')


def build_payload() -> dict:
    cities_path = DASHBOARD / "src/config/airportCities.json"
    cities = json.loads(cities_path.read_text(encoding="utf-8"))["cities"]
    by_code = {city["city_code"]: city for city in cities}
    nodes = [by_code[code] for code in DISPLAY_CODES]
    edges = []
    for index, (origin, destination) in enumerate(EDGE_PAIRS):
        cpi = EDGE_CPI[index]
        edges.append({
            "origin_city_code": origin,
            "destination_city_code": destination,
            "cpi": cpi,
            "quote_count": 48 + index % 19,
            "available_count": 43 + index % 17,
            "no_flight_count": index % 4,
            "source_count": 1,
        })
    return {
        "snapshot_id": SNAPSHOT_ID,
        "frequency": "daily",
        "period": PERIOD,
        "base_period": BASE_PERIOD,
        "source": (
            "MoSPI CPI, May 2026 provisional, Annexure III urban/state indices; "
            "route values are deterministic dashboard dummy data."
        ),
        "nodes": nodes,
        "edges": edges,
    }


def main() -> None:
    payload = build_payload()
    PAYLOAD.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    load_env()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM map_route_cpi_edges WHERE snapshot_id = %s", (SNAPSHOT_ID,))
            for city in payload["nodes"]:
                cur.execute(
                    """INSERT INTO map_city_nodes
                    (city_code, city_name, latitude, longitude, airport_codes, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (city_code) DO UPDATE SET city_name = EXCLUDED.city_name,
                      latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                      airport_codes = EXCLUDED.airport_codes, metadata = EXCLUDED.metadata""",
                    (city["city_code"], city["city_name"], city["latitude"], city["longitude"],
                     city["airport_codes"], json.dumps({"source": "OurAirports airport metadata"})),
                )
            for edge in payload["edges"]:
                cur.execute(
                    """INSERT INTO map_route_cpi_edges
                    (snapshot_id, frequency, period, base_period, origin_city_code,
                     destination_city_code, route_key, cpi, quote_count, available_count,
                     no_flight_count, source_count, metadata, written_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (SNAPSHOT_ID, "daily", PERIOD, BASE_PERIOD, edge["origin_city_code"],
                     edge["destination_city_code"],
                     f"{edge['origin_city_code']}-{edge['destination_city_code']}", edge["cpi"],
                     edge["quote_count"], edge["available_count"], edge["no_flight_count"],
                     edge["source_count"],
                     json.dumps({"dummy": True, "reference": "MoSPI May 2026 urban CPI"}),
                     datetime.now(timezone.utc)),
                )
    print(
        f"Seeded {len(payload['nodes'])} nodes and "
        f"{len(payload['edges'])} map edges into {SNAPSHOT_ID}"
    )


if __name__ == "__main__":
    main()
