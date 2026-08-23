import time
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
