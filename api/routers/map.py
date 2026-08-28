from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query

from api.data_access import load_map_routes
from api.db import get_db_connection
from models.enums import Frequency

router = APIRouter(prefix="/map", tags=["map"])

_ROUTE_PATTERN = re.compile(r"^[A-Z]{3}-[A-Z]{3}$")
_CITY_CODE_PATTERN = re.compile(r"^[A-Z0-9]{3}$")


def _validate_map_routes(routes: list[str] | None) -> None:
    if not routes:
        return
    invalid_routes = [route for route in routes if not _ROUTE_PATTERN.fullmatch(route)]
    if invalid_routes:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid filter 'route': expected route codes like DEL-BOM. "
                f"Invalid values: {', '.join(invalid_routes)}."
            ),
        )


def _validate_map_origin_city(origin_city: str | None) -> None:
    if origin_city is None:
        return
    if not _CITY_CODE_PATTERN.fullmatch(origin_city):
        raise HTTPException(
            status_code=422,
            detail="Invalid filter 'origin_city': expected a three-character city code like DEL.",
        )


@router.get("/routes")
def get_map_routes(
    frequency: Frequency,
    snapshot_id: str | None = None,
    period: str | None = None,
    origin_city: str | None = None,
    route: list[str] | None = Query(None),
    conn=Depends(get_db_connection),
) -> dict:
    _validate_map_routes(route)
    _validate_map_origin_city(origin_city)
    return load_map_routes(
        conn,
        frequency=frequency.value,
        snapshot_id=snapshot_id,
        period=period,
        routes=route,
        origin_city=origin_city,
    )
