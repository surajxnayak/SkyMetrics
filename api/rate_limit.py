"""In-memory fixed-window rate limiter (PRD F-5.4). Single-process, resets
on restart -- an explicitly acceptable limitation for a demo deployment,
not a gap to close here (see the design spec's non-goals).
"""
from __future__ import annotations

import time

from fastapi import Header, HTTPException

MAX_REQUESTS_PER_WINDOW = 60
WINDOW_SECONDS = 60.0


class RateLimiter:
    def __init__(
        self,
        max_requests: int = MAX_REQUESTS_PER_WINDOW,
        window_seconds: float = WINDOW_SECONDS,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: dict[str, tuple[float, int]] = {}

    def check(self, key: str, now: float | None = None) -> bool:
        if now is None:
            now = time.monotonic()
        window_start, count = self._windows.get(key, (now, 0))
        if now - window_start >= self.window_seconds:
            window_start, count = now, 0
        count += 1
        self._windows[key] = (window_start, count)
        return count <= self.max_requests


limiter = RateLimiter()


def enforce_rate_limit(x_api_key: str = Header(...)) -> None:
    if not limiter.check(x_api_key):
        raise HTTPException(status_code=429, detail="rate limit exceeded")
