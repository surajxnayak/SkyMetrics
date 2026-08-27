from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query

from api.data_access import load_map_routes
from api.db import get_db_connection
from models.enums import Frequency

router = APIRouter(prefix="/map", tags=["map"])

_ROUTE_PATTERN = re.compile(r"^[A-Z]{3}-[A-Z]{3}$")


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


@router.get("/routes")
def get_map_routes(
    frequency: Frequency,
    snapshot_id: str | None = None,
    period: str | None = None,
    route: list[str] | None = Query(None),
    conn=Depends(get_db_connection),
) -> dict:
    _validate_map_routes(route)
    return load_map_routes(
        conn,
        frequency=frequency.value,
        snapshot_id=snapshot_id,
        period=period,
        routes=route,
    )
