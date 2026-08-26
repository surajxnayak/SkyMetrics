"""FastAPI app exposing the SkyMetrics APIx and cleaned fare data (PRD
F-5.1/F-5.2/F-5.3/F-5.5), backed by Postgres. No request-time recomputation
-- see the design spec's non-goals.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.auth import require_api_key
from api.data_access import (
    SnapshotNotFoundError,
    list_snapshots,
    load_fare_records,
    load_snapshot,
    load_weights_metadata,
)
from api.db import get_db_connection
from api.rate_limit import enforce_rate_limit
from index.weights import WEIGHTS_PATH

app = FastAPI(title="SkyMetrics APIx API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["X-API-Key"],
)


def get_weights_path() -> Path:
    return WEIGHTS_PATH


router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(require_api_key), Depends(enforce_rate_limit)],
)


@router.get("/index")
def get_index(
    frequency: Literal["daily", "weekly", "monthly"],
    comparison_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> dict:
    return load_snapshot(conn, frequency, comparison_id, start=start, end=end)


@router.get("/fares")
def get_fares(
    origin: str | None = None,
    destination: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> list[dict]:
    try:
        return load_fare_records(conn, origin=origin, destination=destination, start=start, end=end)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/metadata")
def get_metadata(
    conn=Depends(get_db_connection),
    weights_path: Path = Depends(get_weights_path),
) -> dict:
    weights_metadata = load_weights_metadata(weights_path=weights_path)
    return {
        "weights": weights_metadata,
        "formulas": {
            "simple_relative": "Equal-weighted arithmetic mean of price relatives.",
            "laspeyres": "Base-period-weighted arithmetic mean of price relatives.",
            "paasche": "Current-period-weighted harmonic mean of price relatives.",
            "fisher": "Geometric mean of Laspeyres and Paasche.",
        },
        "snapshots": list_snapshots(conn),
    }


app.include_router(router)


@app.exception_handler(SnapshotNotFoundError)
async def snapshot_not_found_handler(request: Request, exc: SnapshotNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})
