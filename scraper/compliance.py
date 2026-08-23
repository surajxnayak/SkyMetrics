"""Compliance guard: robots.txt enforcement + per-domain rate limiting (PRD F-1.4)."""
from __future__ import annotations

import time
import urllib.robotparser
from urllib.parse import urlparse

DEFAULT_TTL_SECONDS = 3600
DEFAULT_MIN_INTERVAL_SECONDS = 5.0
DEFAULT_USER_AGENT = "SkyMetricsBot/0.1 (SIH26056 airfare index prototype)"


class ComplianceGuard:
    def __init__(
        self,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
        min_interval_seconds: float = DEFAULT_MIN_INTERVAL_SECONDS,
        user_agent: str = DEFAULT_USER_AGENT,
    ):
        self.ttl_seconds = ttl_seconds
        self.min_interval_seconds = min_interval_seconds
        self.user_agent = user_agent
        self._robots_cache: dict[str, tuple[urllib.robotparser.RobotFileParser, float]] = {}
        self._last_request_at: dict[str, float] = {}

    def _get_robots(self, domain: str) -> urllib.robotparser.RobotFileParser:
        cached = self._robots_cache.get(domain)
        now = time.monotonic()
        if cached is not None and (now - cached[1]) < self.ttl_seconds:
            return cached[0]
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(f"https://{domain}/robots.txt")
        parser.read()
        self._robots_cache[domain] = (parser, now)
        return parser

    def can_fetch(self, url: str) -> bool:
        domain = urlparse(url).netloc
        parser = self._get_robots(domain)
        return parser.can_fetch(self.user_agent, url)

    def wait_for_slot(self, domain: str) -> None:
        last = self._last_request_at.get(domain)
        now = time.monotonic()
        if last is not None:
            elapsed = now - last
            if elapsed < self.min_interval_seconds:
                time.sleep(self.min_interval_seconds - elapsed)
        self._last_request_at[domain] = time.monotonic()
