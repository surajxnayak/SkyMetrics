"""Compliance guard: robots.txt enforcement + per-domain rate limiting (PRD F-1.4)."""
from __future__ import annotations

import time
import urllib.error
import urllib.request
import urllib.robotparser
from urllib.parse import urlparse

DEFAULT_TTL_SECONDS = 3600
DEFAULT_MIN_INTERVAL_SECONDS = 5.0
DEFAULT_USER_AGENT = "SkyMetricsBot/0.1 (SIH26056 airfare index prototype)"
DEFAULT_ROBOTS_TIMEOUT_SECONDS = 10.0


class ComplianceGuard:
    def __init__(
        self,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
        min_interval_seconds: float = DEFAULT_MIN_INTERVAL_SECONDS,
        user_agent: str = DEFAULT_USER_AGENT,
        robots_timeout_seconds: float = DEFAULT_ROBOTS_TIMEOUT_SECONDS,
    ):
        self.ttl_seconds = ttl_seconds
        self.min_interval_seconds = min_interval_seconds
        self.user_agent = user_agent
        self.robots_timeout_seconds = robots_timeout_seconds
        self._robots_cache: dict[str, tuple[urllib.robotparser.RobotFileParser, float]] = {}
        self._last_request_at: dict[str, float] = {}

    def _get_robots(self, domain: str) -> urllib.robotparser.RobotFileParser:
        """Fetch and parse robots.txt for a domain, with caching.

        Raises HTTPError on 401/403 (fully disallowed).
        Returns parser allowing all on other HTTPError (e.g. 404).
        Raises URLError or timeout on network failures (fail-closed to caller).
        Does not cache failure states.
        """
        domain = domain.lower()
        cached = self._robots_cache.get(domain)
        now = time.monotonic()
        if cached is not None and (now - cached[1]) < self.ttl_seconds:
            return cached[0]

        url = f"https://{domain}/robots.txt"
        parser = urllib.robotparser.RobotFileParser()

        try:
            response = urllib.request.urlopen(url, timeout=self.robots_timeout_seconds)
            content = response.read().decode("utf-8", errors="ignore")
            parser.parse(content.splitlines())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                # 401/403: site is forbidding bots, treat as fully disallowed
                parser.parse(["User-agent: *", "Disallow: /"])
            else:
                # Other HTTP errors (404, 500, etc.): treat as fully allowed
                # (missing robots.txt is a green light)
                parser.parse(["User-agent: *", "Allow: /"])
        except (urllib.error.URLError, TimeoutError):
            # Network errors: fail-closed (don't cache, let caller decide)
            raise

        self._robots_cache[domain] = (parser, now)
        return parser

    def can_fetch(self, url: str) -> bool:
        domain = urlparse(url).netloc.lower()
        try:
            parser = self._get_robots(domain)
            return parser.can_fetch(self.user_agent, url)
        except (urllib.error.URLError, TimeoutError):
            # Network failure: fail-closed, don't scrape
            return False

    def wait_for_slot(self, domain: str) -> None:
        domain = domain.lower()
        last = self._last_request_at.get(domain)
        now = time.monotonic()
        if last is not None:
            elapsed = now - last
            if elapsed < self.min_interval_seconds:
                time.sleep(self.min_interval_seconds - elapsed)
        self._last_request_at[domain] = time.monotonic()
