import io
import time
import urllib.error
import urllib.robotparser

from scraper.compliance import ComplianceGuard


def _parser_from_rules(lines):
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(lines)
    return parser


def test_can_fetch_respects_disallow(monkeypatch):
    guard = ComplianceGuard()
    parser = _parser_from_rules(["User-agent: *", "Disallow: /flights/search"])
    monkeypatch.setattr(guard, "_get_robots", lambda domain: parser)

    assert guard.can_fetch("https://example.com/flights/search?x=1") is False
    assert guard.can_fetch("https://example.com/about") is True


def test_can_fetch_allows_when_robots_allows_all(monkeypatch):
    guard = ComplianceGuard()
    parser = _parser_from_rules(["User-agent: *", "Allow: /"])
    monkeypatch.setattr(guard, "_get_robots", lambda domain: parser)

    assert guard.can_fetch("https://example.com/anything") is True


def test_wait_for_slot_enforces_minimum_interval():
    guard = ComplianceGuard(min_interval_seconds=0.1)
    guard.wait_for_slot("example.com")
    start = time.monotonic()
    guard.wait_for_slot("example.com")
    elapsed = time.monotonic() - start
    assert elapsed >= 0.1


def test_wait_for_slot_does_not_block_different_domains():
    guard = ComplianceGuard(min_interval_seconds=5.0)
    guard.wait_for_slot("example.com")
    start = time.monotonic()
    guard.wait_for_slot("other.com")
    elapsed = time.monotonic() - start
    assert elapsed < 1.0


# Tests for real fetch+cache logic (monkeypatch urllib.request.urlopen)


def test_cache_hit_within_ttl_does_not_refetch(monkeypatch):
    """Cache hit within TTL should not re-fetch."""
    guard = ComplianceGuard(ttl_seconds=10.0)

    fetch_count = 0

    def fake_urlopen(url, timeout=None):
        nonlocal fetch_count
        fetch_count += 1
        response = io.BytesIO(b"User-agent: *\nAllow: /")
        response.headers = {"content-type": "text/plain"}
        response.url = url
        response.msg = None
        response.code = 200
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # First call should fetch
    guard.can_fetch("https://example.com/path")
    assert fetch_count == 1

    # Second call should use cache
    guard.can_fetch("https://example.com/other")
    assert fetch_count == 1


def test_cache_expiry_triggers_refetch(monkeypatch):
    """Cache expiry should trigger a fresh fetch."""
    guard = ComplianceGuard(ttl_seconds=0.05)

    fetch_count = 0

    def fake_urlopen(url, timeout=None):
        nonlocal fetch_count
        fetch_count += 1
        response = io.BytesIO(b"User-agent: *\nAllow: /")
        response.headers = {"content-type": "text/plain"}
        response.url = url
        response.msg = None
        response.code = 200
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # First fetch
    guard.can_fetch("https://example.com/path")
    assert fetch_count == 1

    # Sleep past TTL
    time.sleep(0.06)

    # Second call should re-fetch
    guard.can_fetch("https://example.com/path")
    assert fetch_count == 2


def test_network_error_returns_false_and_is_not_cached(monkeypatch):
    """Network errors (URLError) should return False and not be cached."""
    guard = ComplianceGuard()

    call_count = 0

    def fake_urlopen_fails(url, timeout=None):
        nonlocal call_count
        call_count += 1
        raise urllib.error.URLError("Connection refused")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen_fails)

    # First call should return False due to network error
    assert guard.can_fetch("https://example.com/path") is False
    assert call_count == 1

    # Second call should retry (not cached), not use the cached failure
    assert guard.can_fetch("https://example.com/path") is False
    assert call_count == 2


def test_timeout_error_returns_false_and_is_not_cached(monkeypatch):
    """Timeout errors should return False and not be cached."""
    guard = ComplianceGuard()

    call_count = 0

    def fake_urlopen_timeout(url, timeout=None):
        nonlocal call_count
        call_count += 1
        raise TimeoutError("Request timed out")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen_timeout)

    # First call should return False
    assert guard.can_fetch("https://example.com/path") is False
    assert call_count == 1

    # Second call should retry (not cached)
    assert guard.can_fetch("https://example.com/path") is False
    assert call_count == 2


def test_http_401_is_treated_as_disallowed(monkeypatch):
    """HTTP 401 should be treated as fully disallowed."""
    guard = ComplianceGuard()

    def fake_urlopen(url, timeout=None):
        raise urllib.error.HTTPError(url, 401, "Unauthorized", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Should return False for any path
    assert guard.can_fetch("https://example.com/anything") is False


def test_http_403_is_treated_as_disallowed(monkeypatch):
    """HTTP 403 should be treated as fully disallowed."""
    guard = ComplianceGuard()

    def fake_urlopen(url, timeout=None):
        raise urllib.error.HTTPError(url, 403, "Forbidden", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Should return False for any path
    assert guard.can_fetch("https://example.com/anything") is False


def test_http_404_is_treated_as_allowed(monkeypatch):
    """HTTP 404 (missing robots.txt) should be treated as fully allowed."""
    guard = ComplianceGuard()

    def fake_urlopen(url, timeout=None):
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Should return True for any path (allow all when robots.txt missing)
    assert guard.can_fetch("https://example.com/anything") is True


def test_http_500_is_treated_as_allowed(monkeypatch):
    """HTTP 500 should be treated as fully allowed (permissive fallback)."""
    guard = ComplianceGuard()

    def fake_urlopen(url, timeout=None):
        raise urllib.error.HTTPError(url, 500, "Internal Server Error", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Should return True for any path
    assert guard.can_fetch("https://example.com/anything") is True


def test_domain_case_insensitivity(monkeypatch):
    """Domains should be case-insensitive for caching and rate limiting."""
    guard = ComplianceGuard(ttl_seconds=10.0, min_interval_seconds=0.1)

    fetch_count = 0

    def fake_urlopen(url, timeout=None):
        nonlocal fetch_count
        fetch_count += 1
        response = io.BytesIO(b"User-agent: *\nAllow: /")
        response.headers = {"content-type": "text/plain"}
        response.url = url
        response.msg = None
        response.code = 200
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Call with mixed case domain
    guard.can_fetch("https://Example.COM/path1")
    assert fetch_count == 1

    # Call with lowercase should hit cache
    guard.can_fetch("https://example.com/path2")
    assert fetch_count == 1

    # Rate limiting should also be case-insensitive
    guard.wait_for_slot("Example.COM")
    start = time.monotonic()
    guard.wait_for_slot("example.com")
    elapsed = time.monotonic() - start
    assert elapsed >= 0.1
