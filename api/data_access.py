"""Read-only data access for the API layer (PRD F-5.1/F-5.2/F-5.3): queries
Postgres directly on every call. No caching -- same reasoning as before
(data volume small enough that re-querying every request is simpler and
avoids invalidation bugs), now backed by a real database with real indexes
instead of scanning flat files.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from index.weights import WEIGHTS_PATH

AIRPORT_CITIES_PATH = Path("config/airport_cities.json")
_COMPARISON_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")

_SERIES_COLUMNS = (
    "period", "base_period", "routes", "simple_relative", "laspeyres", "paasche", "fisher",
)


class SnapshotNotFoundError(Exception):
    pass


def _to_float(value):
    return float(value) if value is not None else None


def list_snapshots(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT comparison_id, frequency, MIN(written_at) AS written_at
            FROM index_points
            GROUP BY comparison_id, frequency
            ORDER BY written_at DESC
            """
        )
        rows = cur.fetchall()
    return [
        {
            "comparison_id": comparison_id,
            "frequency": frequency,
            "written_at": written_at.isoformat(),
        }
        for comparison_id, frequency, written_at in rows
    ]


def _resolve_comparison_id(conn, frequency: str, comparison_id: str | None) -> str:
    if comparison_id is not None:
        if not _COMPARISON_ID_PATTERN.fullmatch(comparison_id):
            raise SnapshotNotFoundError(f"no snapshot with comparison_id {comparison_id!r}")
        return comparison_id

    with conn.cursor() as cur:
        cur.execute(
            "SELECT comparison_id FROM index_points WHERE frequency = %s "
            "ORDER BY written_at DESC LIMIT 1",
            (frequency,),
        )
        row = cur.fetchone()
    if row is None:
        raise SnapshotNotFoundError(f"no snapshot found for frequency {frequency!r}")
    return row[0]


def load_snapshot(
    conn,
    frequency: str,
    comparison_id: str | None,
    start: str | None = None,
    end: str | None = None,
) -> dict:
    target_id = _resolve_comparison_id(conn, frequency, comparison_id)

    columns = ", ".join(_SERIES_COLUMNS)
    query = f"SELECT {columns}, frequency FROM index_points WHERE comparison_id = %s"
    params: list = [target_id]
    if start is not None:
        query += " AND period >= %s"
        params.append(start)
    if end is not None:
        query += " AND period <= %s"
        params.append(end)
    query += " ORDER BY period"

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    if not rows:
        raise SnapshotNotFoundError(f"no snapshot with comparison_id {target_id!r}")

    actual_frequency = rows[0][-1]
    if actual_frequency != frequency:
        raise SnapshotNotFoundError(
            f"snapshot {target_id!r} has frequency {actual_frequency!r}, not {frequency!r}"
        )

    series = []
    for row in rows:
        point = dict(zip(_SERIES_COLUMNS, row[:-1]))
        # NUMERIC columns come back from psycopg3 as decimal.Decimal, which
        # FastAPI's bare `-> dict` return annotation serializes as a JSON
        # string rather than a number -- cast to float here, once, at the DB
        # boundary, so every consumer (API JSON, tests) gets real numbers.
        for numeric_key in ("simple_relative", "laspeyres", "paasche", "fisher"):
            if point[numeric_key] is not None:
                point[numeric_key] = _to_float(point[numeric_key])
        for formula_key in ("laspeyres", "paasche", "fisher"):
            if point[formula_key] is None:
                del point[formula_key]
        series.append(point)

    return {"comparison_id": target_id, "frequency": frequency, "series": series}


def _parse_datetime(value: str, *, end_of_day: bool = False) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if end_of_day and len(value) == len("YYYY-MM-DD"):
        parsed += timedelta(days=1) - timedelta(microseconds=1)
    return parsed


_FARE_COLUMNS = (
    "quote_id", "origin", "destination", "carrier", "source", "travel_date", "collected_at",
    "advance_window", "fare_class", "base_fare", "taxes", "udf", "convenience_fee", "total_fare",
    "status", "run_id", "fee_breakdown", "routing", "is_outlier", "source_quote_ids",
)


def load_fare_records(
    conn,
    origin: str | None = None,
    destination: str | None = None,
    routes: list[str] | None = None,
    sources: list[str] | None = None,
    carrier: str | None = None,
    advance_window: str | None = None,
    fare_class: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> list[dict]:
    query = f"SELECT {', '.join(_FARE_COLUMNS)} FROM fare_quotes WHERE true"
    params: list = []
    if origin is not None:
        query += " AND origin = %s"
        params.append(origin)
    if destination is not None:
        query += " AND destination = %s"
        params.append(destination)
    if routes:
        query += " AND origin || '-' || destination = ANY(%s)"
        params.append(routes)
    if sources:
        query += " AND source = ANY(%s)"
        params.append(sources)
    if carrier is not None:
        query += " AND carrier = %s"
        params.append(carrier)
    if advance_window is not None:
        query += " AND advance_window = %s"
        params.append(advance_window)
    if fare_class is not None:
        query += " AND fare_class = %s"
        params.append(fare_class)
    if start is not None:
        query += " AND collected_at >= %s"
        params.append(_parse_datetime(start))
    if end is not None:
        query += " AND collected_at <= %s"
        params.append(_parse_datetime(end, end_of_day=True))

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    records = []
    for row in rows:
        record = dict(zip(_FARE_COLUMNS, row))
        record["travel_date"] = record["travel_date"].isoformat()
        record["collected_at"] = record["collected_at"].isoformat()
        # See the matching comment in load_snapshot above: NUMERIC columns
        # come back as Decimal, which serializes as a JSON string under this
        # endpoint's bare `-> list[dict]` return annotation unless cast here.
        for numeric_key in ("base_fare", "taxes", "udf", "convenience_fee", "total_fare"):
            if record[numeric_key] is not None:
                record[numeric_key] = float(record[numeric_key])
        records.append(record)
    return records


def load_fare_record_table(
    conn,
    routes: list[str] | None = None,
    sources: list[str] | None = None,
    carrier: str | None = None,
    advance_window: str | None = None,
    fare_class: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> dict:
    records = load_fare_records(
        conn,
        routes=routes,
        sources=sources,
        carrier=carrier,
        advance_window=advance_window,
        fare_class=fare_class,
        start=start,
        end=end,
    )
    priced_records = [
        record
        for record in records
        if record["status"] == "available"
        and not record["is_outlier"]
        and record["total_fare"] is not None
    ]
    mean_total_fare = (
        sum(record["total_fare"] for record in priced_records) / len(priced_records)
        if priced_records
        else None
    )

    table_records = []
    for record in records:
        total_fare = record["total_fare"]
        delta_from_mean = (
            total_fare - mean_total_fare
            if mean_total_fare is not None
            and total_fare is not None
            and record["status"] == "available"
            and not record["is_outlier"]
            else None
        )
        table_records.append(
            {
                "quote_id": record["quote_id"],
                "collected_at": record["collected_at"],
                "travel_date": record["travel_date"],
                "route": f"{record['origin']}-{record['destination']}",
                "source": record["source"],
                "carrier": record["carrier"],
                "advance_window": record["advance_window"],
                "fare_class": record["fare_class"],
                "routing": record["routing"],
                "status": record["status"],
                "is_outlier": record["is_outlier"],
                "total_fare": total_fare,
                "delta_from_mean": delta_from_mean,
            }
        )

    table_records.sort(
        key=lambda record: (
            record["collected_at"],
            record["route"],
            record["carrier"],
            record["total_fare"] is None,
            record["total_fare"] or 0,
        )
    )
    return {"mean_total_fare": mean_total_fare, "records": table_records}


def _load_config_city_nodes(cities_path: Path = AIRPORT_CITIES_PATH) -> list[dict]:
    payload = json.loads(cities_path.read_text(encoding="utf-8"))
    return [
        {
            "city_code": city["city_code"],
            "city_name": city["city_name"],
            "latitude": city["latitude"],
            "longitude": city["longitude"],
            "airport_codes": city["airport_codes"],
        }
        for city in payload["cities"]
    ]


def load_map_city_nodes(conn, cities_path: Path = AIRPORT_CITIES_PATH) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT city_code, city_name, latitude, longitude, airport_codes
            FROM map_city_nodes
            WHERE is_active
            ORDER BY city_name
            """
        )
        rows = cur.fetchall()

    if not rows:
        return _load_config_city_nodes(cities_path)

    return [
        {
            "city_code": city_code,
            "city_name": city_name,
            "latitude": _to_float(latitude),
            "longitude": _to_float(longitude),
            "airport_codes": airport_codes,
        }
        for city_code, city_name, latitude, longitude, airport_codes in rows
    ]


def _reverse_route(route: str) -> str:
    origin, destination = route.split("-", 1)
    return f"{destination}-{origin}"


def _resolve_map_snapshot(
    conn, frequency: str, snapshot_id: str | None, period: str | None
) -> tuple[str | None, str | None]:
    query = "SELECT snapshot_id, period FROM map_route_cpi_edges WHERE frequency = %s"
    params: list = [frequency]
    if snapshot_id is not None:
        query += " AND snapshot_id = %s"
        params.append(snapshot_id)
    if period is not None:
        query += " AND period = %s"
        params.append(period)
    query += " ORDER BY written_at DESC LIMIT 1"

    with conn.cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
    return row if row is not None else (snapshot_id, period)


def load_map_routes(
    conn,
    frequency: str,
    snapshot_id: str | None = None,
    period: str | None = None,
    routes: list[str] | None = None,
    origin_city: str | None = None,
) -> dict:
    resolved_snapshot_id, resolved_period = _resolve_map_snapshot(
        conn, frequency, snapshot_id, period
    )

    if resolved_snapshot_id is None or resolved_period is None:
        return {
            "snapshot_id": resolved_snapshot_id,
            "frequency": frequency,
            "period": resolved_period,
            "edges": [],
        }

    query = """
        SELECT snapshot_id, frequency, period, base_period, origin_city_code,
               destination_city_code, route_key, cpi, quote_count, available_count,
               no_flight_count, source_count, written_at
        FROM map_route_cpi_edges
        WHERE snapshot_id = %s AND frequency = %s AND period = %s
    """
    params: list = [resolved_snapshot_id, frequency, resolved_period]
    if routes:
        expanded_routes = sorted(set(routes) | {_reverse_route(route) for route in routes})
        query += " AND route_key = ANY(%s)"
        params.append(expanded_routes)
    if origin_city is not None:
        query += " AND (origin_city_code = %s OR destination_city_code = %s)"
        params.extend([origin_city, origin_city])
    query += " ORDER BY origin_city_code, destination_city_code"

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    edge_groups: dict[tuple[str, str], dict] = {}
    for row in rows:
        (
            row_snapshot_id,
            row_frequency,
            row_period,
            base_period,
            origin_city_code,
            destination_city_code,
            route_key,
            cpi,
            quote_count,
            available_count,
            no_flight_count,
            source_count,
            written_at,
        ) = row
        city_a, city_b = sorted((origin_city_code, destination_city_code))
        key = (city_a, city_b)
        group = edge_groups.setdefault(
            key,
            {
                "edge_key": f"{city_a}|{city_b}",
                "city_a": city_a,
                "city_b": city_b,
                "city_a_to_b": None,
                "city_b_to_a": None,
            },
        )
        direction = {
            "snapshot_id": row_snapshot_id,
            "frequency": row_frequency,
            "period": row_period,
            "base_period": base_period,
            "route_key": route_key,
            "origin_city_code": origin_city_code,
            "destination_city_code": destination_city_code,
            "cpi": _to_float(cpi),
            "quote_count": quote_count,
            "available_count": available_count,
            "no_flight_count": no_flight_count,
            "source_count": source_count,
            "written_at": written_at.isoformat(),
        }
        if origin_city_code == city_a:
            group["city_a_to_b"] = direction
        else:
            group["city_b_to_a"] = direction

    return {
        "snapshot_id": resolved_snapshot_id,
        "frequency": frequency,
        "period": resolved_period,
        "edges": list(edge_groups.values()),
    }


def load_weights_metadata(weights_path: Path = WEIGHTS_PATH) -> dict:
    import json

    return json.loads(weights_path.read_text(encoding="utf-8"))
