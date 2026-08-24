"""FastAPI app exposing the SkyMetrics APIx and cleaned fare data (PRD
F-5.1/F-5.2/F-5.3/F-5.5) over already-computed files on disk. No database,
no request-time recomputation -- see the design spec's non-goals.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from api.auth import require_api_key
from api.data_access import (
    SnapshotNotFoundError,
    filter_fare_records,
    filter_series,
    list_snapshots,
    load_fare_records,
    load_snapshot,
    load_weights_metadata,
)
from api.rate_limit import enforce_rate_limit
from index.build import CLEANED_BASE_DIR, INDEX_BASE_DIR
from index.weights import WEIGHTS_PATH

app = FastAPI(title="SkyMetrics APIx API", version="1.0.0")


def get_index_base_dir() -> Path:
    return INDEX_BASE_DIR


def get_cleaned_base_dir() -> Path:
    return CLEANED_BASE_DIR


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
    index_base_dir: Path = Depends(get_index_base_dir),
) -> dict:
    snapshot = load_snapshot(frequency, comparison_id, index_base_dir=index_base_dir)
    series = filter_series(snapshot["series"], start=start, end=end)
    return {
        "comparison_id": snapshot["comparison_id"],
        "frequency": snapshot["frequency"],
        "series": series,
    }


@router.get("/fares")
def get_fares(
    origin: str | None = None,
    destination: str | None = None,
    start: str | None = None,
    end: str | None = None,
    cleaned_base_dir: Path = Depends(get_cleaned_base_dir),
) -> list[dict]:
    records = load_fare_records(cleaned_base_dir=cleaned_base_dir)
    return filter_fare_records(
        records, origin=origin, destination=destination, start=start, end=end
    )


@router.get("/metadata")
def get_metadata(
    index_base_dir: Path = Depends(get_index_base_dir),
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
        "snapshots": list_snapshots(index_base_dir=index_base_dir),
    }


app.include_router(router)


@app.exception_handler(SnapshotNotFoundError)
async def snapshot_not_found_handler(request: Request, exc: SnapshotNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})
