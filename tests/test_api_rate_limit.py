import pytest
from fastapi import HTTPException

from api import rate_limit
from api.rate_limit import RateLimiter, enforce_rate_limit


def test_allows_requests_under_the_limit():
    limiter = RateLimiter(max_requests=3, window_seconds=60.0)

    assert limiter.check("key-a") is True
    assert limiter.check("key-a") is True
    assert limiter.check("key-a") is True


def test_blocks_requests_over_the_limit():
    limiter = RateLimiter(max_requests=2, window_seconds=60.0)

    assert limiter.check("key-a") is True
    assert limiter.check("key-a") is True
    assert limiter.check("key-a") is False


def test_tracks_each_key_independently():
    limiter = RateLimiter(max_requests=1, window_seconds=60.0)

    assert limiter.check("key-a") is True
    assert limiter.check("key-b") is True
    assert limiter.check("key-a") is False


def test_resets_after_the_window_elapses():
    limiter = RateLimiter(max_requests=1, window_seconds=10.0)

    assert limiter.check("key-a", now=1000.0) is True
    assert limiter.check("key-a", now=1005.0) is False
    assert limiter.check("key-a", now=1011.0) is True


def test_enforce_rate_limit_raises_429_when_over_limit(monkeypatch):
    monkeypatch.setattr(rate_limit, "limiter", RateLimiter(max_requests=1, window_seconds=60.0))
    rate_limit.limiter.check("key-a")  # consume the one allowed request

    with pytest.raises(HTTPException) as exc_info:
        enforce_rate_limit(x_api_key="key-a")

    assert exc_info.value.status_code == 429


def test_enforce_rate_limit_allows_under_limit(monkeypatch):
    monkeypatch.setattr(rate_limit, "limiter", RateLimiter(max_requests=5, window_seconds=60.0))

    enforce_rate_limit(x_api_key="key-a")  # should not raise
