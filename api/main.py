"""
FastAPI app exposing the SkyMetrics APIx and cleaned fare data (PRD
F-5.1/F-5.2/F-5.3/F-5.5), backed by Postgres. No request-time recomputation
-- see the design spec's non-goals.
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.ask import answer_question
from api.auth import require_api_key
from api.data_access import (
    SnapshotNotFoundError,
    list_snapshots,
    load_fare_record_table,
    load_fare_records,
    load_snapshot,
    load_weights_metadata,
)
from api.db import get_db_connection
from api.rate_limit import enforce_rate_limit
from index.weights import WEIGHTS_PATH
from models.enums import AirportCode, CarrierCode, Frequency, SourceName
from scraper.schema import ADVANCE_WINDOWS

app = FastAPI(title="SkyMetrics APIx API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["X-API-Key"],
)


def get_weights_path() -> Path:
    return WEIGHTS_PATH


_WEEK_PATTERN = re.compile(r"^\d{4}-W\d{2}$")
_MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")
_FARE_CLASS_PATTERN = re.compile(r"^[A-Z0-9_-]{1,20}$")
_VALID_ROUTES = {"DEL-BOM", "DEL-BLR", "BOM-BLR"}


def _validate_datetime_bounds(start: str | None, end: str | None) -> None:
    parsed_start = _parse_filter_datetime("start", start) if start is not None else None
    parsed_end = _parse_filter_datetime("end", end) if end is not None else None
    if parsed_start is not None and parsed_end is not None and parsed_start > parsed_end:
        raise HTTPException(status_code=422, detail="Invalid filters: start must be before end.")


def _parse_filter_datetime(field: str, value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid filter '{field}': use ISO format, for example 2026-08-24.",
        ) from exc


def _validate_period_bounds(frequency: Frequency, start: str | None, end: str | None) -> None:
    for field, value in (("start", start), ("end", end)):
        if value is None:
            continue
        if frequency == Frequency.DAILY:
            _parse_filter_datetime(field, value)
        elif frequency == Frequency.WEEKLY and not _WEEK_PATTERN.fullmatch(value):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid filter '{field}': weekly periods must look like 2026-W34.",
            )
        elif frequency == Frequency.MONTHLY:
            if not _MONTH_PATTERN.fullmatch(value):
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid filter '{field}': monthly periods must look like 2026-08.",
                )
            month = int(value[-2:])
            if not 1 <= month <= 12:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid filter '{field}': month must be between 01 and 12.",
                )
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="Invalid filters: start must be before end.")


def _validate_route(origin: AirportCode | None, destination: AirportCode | None) -> None:
    if origin is not None and destination is not None and origin == destination:
        raise HTTPException(
            status_code=422,
            detail="Invalid filters: origin and destination must be different airports.",
        )


def _validate_routes(routes: list[str] | None) -> None:
    if not routes:
        return
    invalid_routes = sorted(set(routes) - _VALID_ROUTES)
    if invalid_routes:
        valid = ", ".join(sorted(_VALID_ROUTES))
        invalid = ", ".join(invalid_routes)
        raise HTTPException(
            status_code=422,
            detail=f"Invalid filter 'route': {invalid}. Expected one of {valid}.",
        )


def _validate_advance_window(advance_window: str | None) -> None:
    if advance_window is None:
        return
    if advance_window not in ADVANCE_WINDOWS:
        valid = ", ".join(ADVANCE_WINDOWS)
        raise HTTPException(
            status_code=422,
            detail=f"Invalid filter 'advance_window': expected one of {valid}.",
        )


def _validate_fare_class(fare_class: str | None) -> None:
    if fare_class is None:
        return
    if not _FARE_CLASS_PATTERN.fullmatch(fare_class):
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid filter 'fare_class': use 1-20 letters, numbers, underscores, "
                "or hyphens."
            ),
        )


def _validate_fare_filters(
    *,
    origin: AirportCode | None,
    destination: AirportCode | None,
    routes: list[str] | None,
    start: str | None,
    end: str | None,
    advance_window: str | None,
    fare_class: str | None,
) -> None:
    _validate_route(origin, destination)
    _validate_routes(routes)
    _validate_datetime_bounds(start, end)
    _validate_advance_window(advance_window)
    _validate_fare_class(fare_class)


router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(require_api_key), Depends(enforce_rate_limit)],
)


@router.get("/index")
def get_index(
    frequency: Frequency,
    comparison_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> dict:
    _validate_period_bounds(frequency, start, end)
    return load_snapshot(conn, frequency, comparison_id, start=start, end=end)


@router.get("/fares")
def get_fares(
    origin: AirportCode | None = None,
    destination: AirportCode | None = None,
    route: list[str] | None = Query(None),
    source: list[SourceName] | None = Query(None),
    carrier: CarrierCode | None = None,
    advance_window: str | None = None,
    fare_class: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> list[dict]:
    try:
        _validate_fare_filters(
            origin=origin,
            destination=destination,
            routes=route,
            start=start,
            end=end,
            advance_window=advance_window,
            fare_class=fare_class,
        )
        return load_fare_records(
            conn,
            origin=origin.value if origin is not None else None,
            destination=destination.value if destination is not None else None,
            routes=route,
            sources=[item.value for item in source] if source else None,
            carrier=carrier.value if carrier is not None else None,
            advance_window=advance_window,
            fare_class=fare_class,
            start=start,
            end=end,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/fare-records")
def get_fare_records(
    route: list[str] | None = Query(None),
    source: list[SourceName] | None = Query(None),
    carrier: CarrierCode | None = None,
    advance_window: str | None = None,
    fare_class: str | None = None,
    start: str | None = None,
    end: str | None = None,
    conn=Depends(get_db_connection),
) -> dict:
    try:
        _validate_fare_filters(
            origin=None,
            destination=None,
            routes=route,
            start=start,
            end=end,
            advance_window=advance_window,
            fare_class=fare_class,
        )
        return load_fare_record_table(
            conn,
            routes=route,
            sources=[item.value for item in source] if source else None,
            carrier=carrier.value if carrier is not None else None,
            advance_window=advance_window,
            fare_class=fare_class,
            start=start,
            end=end,
        )
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


class ChatTurn(BaseModel):
    role: str
    text: str


class AskRequest(BaseModel):
    question: str
    history: list[ChatTurn] = []


class ToolCallOut(BaseModel):
    name: str
    args: dict
    result: dict


class AskResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallOut]


@router.post("/ask")
def post_ask(body: AskRequest, conn=Depends(get_db_connection)) -> AskResponse:
    result = answer_question(
        body.question, [turn.model_dump() for turn in body.history], conn
    )
    return AskResponse(**result)


app.include_router(router)


@app.exception_handler(RequestValidationError)
async def request_validation_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    enum_options = {
        "frequency": ", ".join(item.value for item in Frequency),
        "origin": ", ".join(item.value for item in AirportCode),
        "destination": ", ".join(item.value for item in AirportCode),
        "source": ", ".join(item.value for item in SourceName),
        "carrier": ", ".join(item.value for item in CarrierCode),
    }
    messages = []
    for error in exc.errors():
        loc = error.get("loc", ())
        field = next((str(part) for part in reversed(loc) if isinstance(part, str)), "request")
        if field in enum_options:
            messages.append(f"Invalid filter '{field}': expected one of {enum_options[field]}.")
        else:
            messages.append(f"Invalid filter '{field}': {error.get('msg', 'invalid value')}.")
    return JSONResponse(status_code=422, content={"detail": " ".join(messages)})


@app.exception_handler(SnapshotNotFoundError)
async def snapshot_not_found_handler(
    request: Request,
    exc: SnapshotNotFoundError,
) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})
