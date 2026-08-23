# SkyMetrics Phase 1: Repo Scaffold + Akasa Air Scraper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a professional repo foundation and a working, robots.txt-compliant scraper that pulls real Akasa Air fares for 3 city-pairs across 5 advance-purchase windows into provenance-tagged JSONL files.

**Architecture:** A compliance guard (stdlib `urllib.robotparser` + a per-domain rate limiter) gates every HTTP call. `AkasaScraper` implements a small `BaseScraper` interface and calls Akasa's real, verified, unauthenticated fare-calendar endpoint (`prod-bl.qp.akasaair.com`) via plain `urllib.request` — no browser automation needed. Results are validated against a `FareQuote` dataclass and written to `data/raw/<source>/<run_id>.jsonl`. A `sources.json` registry documents the live compliance status of all 11 PRD-named sources; only `run.py`'s `SCRAPERS` mapping actually invokes scrapers, and a test enforces that mapping never includes a non-active source.

**Tech Stack:** Python 3.11+, stdlib only for the runtime code (`urllib.request`, `urllib.robotparser`, `dataclasses`, `json`). `pytest` + `ruff` as dev-only tools. GitHub Actions for CI and the scheduled daily run.

**Reference:** See `docs/superpowers/specs/2026-08-23-repo-scaffold-and-phase1-scraper-design.md` for the full compliance audit and the live-verified endpoint details this plan implements.

---

### Task 1: Repo scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`
- Create: `requirements-dev.txt`
- Create: `config/sources.json`
- Create: `config/basket.json`
- Create: `scraper/__init__.py`
- Create: `scraper/sources/__init__.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I"]
```

- [ ] **Step 2: Create `.gitignore`**

```
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/
.pytest_cache/
.ruff_cache/
data/raw/
.env
.DS_Store
```

- [ ] **Step 3: Create `requirements-dev.txt`**

```
pytest>=8.0
ruff>=0.6
```

- [ ] **Step 4: Create `LICENSE`** (MIT)

```
MIT License

Copyright (c) 2026 SkyMetrics contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Create `README.md`**

```markdown
# SkyMetrics

Real-time Airfare Price Index (APIx) for India — Smart India Hackathon 2026
submission (problem statement SIH26056, MoSPI/DIID).

## Status

**Phase 1** (of 5 — see `docs/superpowers/specs/`): a working, robots.txt-compliant
scraper for Akasa Air across 3 city-pairs and 5 advance-purchase windows.
Cleaning, index construction, dashboard, and API are later phases.

## Why only one live source right now

All 11 airline/OTA sources named in the problem statement were live-checked
for robots.txt and access-control compliance before any scraper was written.
Only Akasa Air currently permits it — see `config/sources.json` for the full
audit (status + reason per source) and
`docs/superpowers/specs/2026-08-23-repo-scaffold-and-phase1-scraper-design.md`
for how each was verified. This project does not circumvent robots.txt, ToS,
or anti-bot protections; a blocked source stays blocked until it's genuinely
compliant.

## Setup

Requires Python 3.11+. No runtime dependencies — the scraper is stdlib-only.

```bash
pip install -r requirements-dev.txt
```

## Running the scraper

```bash
python -m scraper.run
```

Writes raw fare quotes to `data/raw/<source>/<run_id>.jsonl`.

## Testing

```bash
pytest
ruff check .
```

## License

MIT — see `LICENSE`.
```

- [ ] **Step 6: Create `config/basket.json`**

```json
{
  "city_pairs": [
    {"origin": "DEL", "destination": "BOM"},
    {"origin": "DEL", "destination": "BLR"},
    {"origin": "BOM", "destination": "BLR"}
  ]
}
```

- [ ] **Step 7: Create `config/sources.json`**

```json
{
  "sources": [
    {
      "name": "akasaair",
      "type": "airline",
      "status": "active",
      "checked_at": "2026-08-23",
      "reason": "robots.txt fully open on www.akasaair.com; booking backend prod-bl.qp.akasaair.com has no robots.txt (default allow)"
    },
    {
      "name": "spicejet",
      "type": "airline",
      "status": "blocked_by_robots",
      "checked_at": "2026-08-23",
      "reason": "real search API lives under /api/v1/..., explicitly disallowed by robots.txt"
    },
    {
      "name": "air_india_express",
      "type": "airline",
      "status": "blocked_by_robots",
      "checked_at": "2026-08-23",
      "reason": "robots.txt disallows /flight-availability"
    },
    {
      "name": "indigo",
      "type": "airline",
      "status": "blocked_by_waf",
      "checked_at": "2026-08-23",
      "reason": "TLS/edge connection blocked before robots.txt loads"
    },
    {
      "name": "air_india",
      "type": "airline",
      "status": "blocked_by_waf",
      "checked_at": "2026-08-23",
      "reason": "TLS/edge connection blocked before robots.txt loads"
    },
    {
      "name": "cleartrip",
      "type": "ota",
      "status": "blocked_by_robots",
      "checked_at": "2026-08-23",
      "reason": "robots.txt disallows /flights/search*"
    },
    {
      "name": "easemytrip",
      "type": "ota",
      "status": "blocked_by_robots",
      "checked_at": "2026-08-23",
      "reason": "robots.txt disallows /flight-search/listing*"
    },
    {
      "name": "ixigo",
      "type": "ota",
      "status": "blocked_by_robots",
      "checked_at": "2026-08-23",
      "reason": "robots.txt disallows /flights/search, /flights/review"
    },
    {
      "name": "makemytrip",
      "type": "ota",
      "status": "blocked_by_waf",
      "checked_at": "2026-08-23",
      "reason": "TLS/edge connection blocked"
    },
    {
      "name": "goibibo",
      "type": "ota",
      "status": "blocked_by_waf",
      "checked_at": "2026-08-23",
      "reason": "TLS/edge connection blocked"
    },
    {
      "name": "yatra",
      "type": "ota",
      "status": "blocked_by_waf",
      "checked_at": "2026-08-23",
      "reason": "TLS/edge connection blocked"
    }
  ]
}
```

- [ ] **Step 8: Create empty package markers**

```bash
mkdir -p scraper/sources tests
touch scraper/__init__.py scraper/sources/__init__.py
```

- [ ] **Step 9: Commit**

```bash
git add pyproject.toml .gitignore LICENSE README.md requirements-dev.txt config/ scraper/__init__.py scraper/sources/__init__.py
git commit -m "chore: repo scaffold (license, gitignore, config, package layout)"
```

---

### Task 2: Fare-quote schema

**Files:**
- Create: `scraper/schema.py`
- Test: `tests/test_schema.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_schema.py
from datetime import date, datetime, timezone

import pytest

from scraper.schema import FareQuote, new_quote_id


def make_quote(**overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=6530.0,
        status="available",
        run_id="run-1",
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_valid_quote_constructs():
    quote = make_quote()
    assert quote.total_fare == 6530.0


def test_rejects_invalid_advance_window():
    with pytest.raises(ValueError):
        make_quote(advance_window="T+99")


def test_rejects_invalid_status():
    with pytest.raises(ValueError):
        make_quote(status="maybe")


def test_to_json_dict_serialises_dates():
    quote = make_quote()
    d = quote.to_json_dict()
    assert d["travel_date"] == "2026-09-01"
    assert d["collected_at"] == "2026-08-23T12:00:00+00:00"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_schema.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scraper.schema'`

- [ ] **Step 3: Write `scraper/schema.py`**

```python
"""Fare-record schema shared by all scrapers (PRD §6.2)."""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Optional

ADVANCE_WINDOWS: dict[str, int] = {
    "T+1": 1,
    "T+7": 7,
    "T+15": 15,
    "T+30": 30,
    "T+45": 45,
}

VALID_STATUSES = {"available", "sold_out", "cancelled", "no_flight"}


@dataclass(frozen=True)
class FareQuote:
    quote_id: str
    origin: str
    destination: str
    carrier: str
    source: str
    travel_date: date
    collected_at: datetime
    advance_window: str
    fare_class: Optional[str]
    base_fare: Optional[float]
    taxes: Optional[float]
    udf: Optional[float]
    convenience_fee: Optional[float]
    total_fare: Optional[float]
    status: str
    run_id: str

    def __post_init__(self):
        if self.advance_window not in ADVANCE_WINDOWS:
            raise ValueError(f"invalid advance_window: {self.advance_window!r}")
        if self.status not in VALID_STATUSES:
            raise ValueError(f"invalid status: {self.status!r}")

    def to_json_dict(self) -> dict:
        d = asdict(self)
        d["travel_date"] = self.travel_date.isoformat()
        d["collected_at"] = self.collected_at.isoformat()
        return d


def new_quote_id() -> str:
    return str(uuid.uuid4())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_schema.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scraper/schema.py tests/test_schema.py
git commit -m "feat: FareQuote schema with validation"
```

---

### Task 3: Compliance guard

**Files:**
- Create: `scraper/compliance.py`
- Test: `tests/test_compliance.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_compliance.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_compliance.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scraper.compliance'`

- [ ] **Step 3: Write `scraper/compliance.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_compliance.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scraper/compliance.py tests/test_compliance.py
git commit -m "feat: compliance guard (robots.txt + rate limiting)"
```

---

### Task 4: BaseScraper interface

**Files:**
- Create: `scraper/base.py`

No test for this file: it is a pure abstract interface with no logic to verify (per project convention, trivial code needs no test).

- [ ] **Step 1: Write `scraper/base.py`**

```python
"""Common interface every source scraper implements."""
from __future__ import annotations

from abc import ABC, abstractmethod

from scraper.schema import FareQuote


class BaseScraper(ABC):
    source_name: str
    carrier_code: str

    @abstractmethod
    def fetch_quotes(self, origin: str, destination: str, run_id: str) -> list[FareQuote]:
        """Fetch fare quotes for every configured advance-purchase window."""
```

- [ ] **Step 2: Commit**

```bash
git add scraper/base.py
git commit -m "feat: BaseScraper interface"
```

---

### Task 5: Akasa Air scraper

**Files:**
- Create: `scraper/sources/akasa.py`
- Test: `tests/test_akasa.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_akasa.py
import json
from datetime import date, timedelta
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pytest

import scraper.sources.akasa as akasa_module
from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper


class _FrozenDate(date):
    @classmethod
    def today(cls):
        return date(2026, 8, 23)


def _fake_urlopen_factory(sold_out=False):
    def fake_urlopen(request, timeout=15):
        query = parse_qs(urlparse(request.full_url).query)
        start = date.fromisoformat(query["startDate"][0][:10])
        entries = []
        for i in range(31):
            d = start + timedelta(days=i)
            entries.append(
                {
                    "date": f"{d.isoformat()}T00:00:00",
                    "isLowest": False,
                    "noFlights": False,
                    "price": 5000.0 + i,
                    "soldOut": sold_out,
                }
            )
        payload = json.dumps({"data": entries}).encode()
        response = MagicMock()
        response.read.return_value = payload
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    return fake_urlopen


def _guard_allowing_everything():
    guard = ComplianceGuard()
    guard.can_fetch = lambda url: True
    guard.wait_for_slot = lambda domain: None
    return guard


def test_fetch_quotes_returns_one_per_advance_window(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    monkeypatch.setattr("urllib.request.urlopen", _fake_urlopen_factory())

    scraper = AkasaScraper(_guard_allowing_everything())
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="run-1")

    assert len(quotes) == 5
    assert {q.advance_window for q in quotes} == {"T+1", "T+7", "T+15", "T+30", "T+45"}
    for q in quotes:
        assert q.origin == "DEL"
        assert q.destination == "BOM"
        assert q.carrier == "QP"
        assert q.source == "akasaair"
        assert q.status == "available"
        assert q.total_fare is not None


def test_fetch_quotes_marks_sold_out_dates(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    monkeypatch.setattr("urllib.request.urlopen", _fake_urlopen_factory(sold_out=True))

    scraper = AkasaScraper(_guard_allowing_everything())
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="run-1")

    assert all(q.status == "sold_out" and q.total_fare is None for q in quotes)


def test_fetch_quotes_raises_when_robots_disallows(monkeypatch):
    monkeypatch.setattr(akasa_module, "date", _FrozenDate)
    guard = ComplianceGuard()
    guard.can_fetch = lambda url: False

    scraper = AkasaScraper(guard)
    with pytest.raises(PermissionError):
        scraper.fetch_quotes("DEL", "BOM", run_id="run-1")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_akasa.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scraper.sources.akasa'`

- [ ] **Step 3: Write `scraper/sources/akasa.py`**

```python
"""Akasa Air scraper (PRD source list, §3.3).

Endpoint verified 2026-08-23 by tracing the live booking widget's network
calls: a plain, unauthenticated JSON GET on prod-bl.qp.akasaair.com (a
domain with no robots.txt of its own -- default allow). Returns a
31-day fare calendar per call; two calls cover all five advance-purchase
windows (T+1 through T+45). The calendar gives a blended lowest-fare-per-day
figure, not a fare-class/component breakdown, so fare_class/base_fare/taxes/
udf/convenience_fee are left null here -- decomposing total_fare into
components is Phase 2's job (PRD F-2.1), not Phase 1's.
"""
from __future__ import annotations

import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode

from scraper.base import BaseScraper
from scraper.compliance import ComplianceGuard
from scraper.schema import ADVANCE_WINDOWS, FareQuote, new_quote_id

CALENDAR_URL = "https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search"
CALENDAR_DOMAIN = "prod-bl.qp.akasaair.com"
CALL_OFFSETS_DAYS = (0, 16)  # two 31-day windows starting today and today+16 cover T+1..T+45


class AkasaScraper(BaseScraper):
    source_name = "akasaair"
    carrier_code = "QP"

    def __init__(self, compliance: ComplianceGuard):
        self.compliance = compliance

    def fetch_quotes(self, origin: str, destination: str, run_id: str) -> list[FareQuote]:
        today = date.today()
        by_date: dict[str, dict] = {}
        for offset in CALL_OFFSETS_DAYS:
            start = today + timedelta(days=offset)
            by_date.update(self._fetch_calendar(origin, destination, start))

        collected_at = datetime.now(timezone.utc)
        quotes = []
        for window, days_ahead in ADVANCE_WINDOWS.items():
            travel_date = today + timedelta(days=days_ahead)
            entry = by_date.get(travel_date.isoformat())
            quotes.append(
                self._to_quote(origin, destination, travel_date, window, entry, collected_at, run_id)
            )
        return quotes

    def _fetch_calendar(self, origin: str, destination: str, start: date) -> dict[str, dict]:
        params = {
            "origin": origin,
            "destination": destination,
            "startDate": start.strftime("%Y-%m-%dT00:00:00+05:30"),
            "numberOfPassengers": 1,
            "channel": "WEB",
            "currencyCode": "INR",
        }
        url = f"{CALENDAR_URL}?{urlencode(params)}"

        if not self.compliance.can_fetch(url):
            raise PermissionError(f"robots.txt disallows fetching {url}")

        self.compliance.wait_for_slot(CALENDAR_DOMAIN)
        request = urllib.request.Request(
            url, headers={"Accept": "application/json", "User-Agent": self.compliance.user_agent}
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            body = json.loads(response.read())

        return {entry["date"][:10]: entry for entry in body["data"]}

    def _to_quote(self, origin, destination, travel_date, window, entry, collected_at, run_id):
        if entry is None or entry.get("noFlights"):
            status, total_fare = "no_flight", None
        elif entry.get("soldOut"):
            status, total_fare = "sold_out", None
        else:
            status, total_fare = "available", entry["price"]

        return FareQuote(
            quote_id=new_quote_id(),
            origin=origin,
            destination=destination,
            carrier=self.carrier_code,
            source=self.source_name,
            travel_date=travel_date,
            collected_at=collected_at,
            advance_window=window,
            fare_class=None,
            base_fare=None,
            taxes=None,
            udf=None,
            convenience_fee=None,
            total_fare=total_fare,
            status=status,
            run_id=run_id,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_akasa.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scraper/sources/akasa.py tests/test_akasa.py
git commit -m "feat: Akasa Air scraper against verified live endpoint"
```

---

### Task 6: JSONL storage

**Files:**
- Create: `scraper/storage.py`
- Test: `tests/test_storage.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_storage.py
import json
from datetime import date, datetime, timezone

from scraper.schema import FareQuote, new_quote_id
from scraper.storage import write_quotes


def _quote(travel_date, total_fare, status="available"):
    return FareQuote(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=travel_date,
        collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=total_fare,
        status=status,
        run_id="run-1",
    )


def test_write_quotes_creates_one_line_per_quote(tmp_path):
    quotes = [_quote(date(2026, 8, 30), 6530.0), _quote(date(2026, 9, 6), 6893.0)]

    out_path = write_quotes(quotes, source="akasaair", run_id="run-1", base_dir=tmp_path)

    assert out_path == tmp_path / "akasaair" / "run-1.jsonl"
    lines = out_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["origin"] == "DEL"
    assert first["travel_date"] == "2026-08-30"
    assert first["total_fare"] == 6530.0


def test_write_quotes_creates_parent_directories(tmp_path):
    quotes = [_quote(date(2026, 8, 30), 6530.0)]
    out_path = write_quotes(quotes, source="akasaair", run_id="run-2", base_dir=tmp_path / "nested")
    assert out_path.exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_storage.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scraper.storage'`

- [ ] **Step 3: Write `scraper/storage.py`**

```python
"""JSONL raw-quote writer with provenance (PRD §6.2)."""
from __future__ import annotations

import json
from pathlib import Path

from scraper.schema import FareQuote

DEFAULT_BASE_DIR = Path("data/raw")


def write_quotes(
    quotes: list[FareQuote], source: str, run_id: str, base_dir: Path = DEFAULT_BASE_DIR
) -> Path:
    out_dir = base_dir / source
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{run_id}.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for quote in quotes:
            f.write(json.dumps(quote.to_json_dict()) + "\n")
    return out_path
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_storage.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scraper/storage.py tests/test_storage.py
git commit -m "feat: JSONL raw-quote storage"
```

---

### Task 7: CLI entrypoint + registry consistency test

**Files:**
- Create: `scraper/run.py`
- Test: `tests/test_run.py`
- Test: `tests/test_sources_registry.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_run.py
import json
from datetime import date, datetime, timezone

from scraper import run as run_module
from scraper.schema import FareQuote, new_quote_id


def test_load_basket_reads_config_file():
    basket = run_module.load_basket()
    assert {"origin": "DEL", "destination": "BOM"} in basket["city_pairs"]


class _StubScraper:
    source_name = "stubsource"
    carrier_code = "ZZ"

    def __init__(self, compliance):
        self.compliance = compliance

    def fetch_quotes(self, origin, destination, run_id):
        return [
            FareQuote(
                quote_id=new_quote_id(),
                origin=origin,
                destination=destination,
                carrier="ZZ",
                source="stubsource",
                travel_date=date(2026, 9, 1),
                collected_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
                advance_window="T+7",
                fare_class=None,
                base_fare=None,
                taxes=None,
                udf=None,
                convenience_fee=None,
                total_fare=1234.0,
                status="available",
                run_id=run_id,
            )
        ]


def test_run_writes_quotes_for_each_configured_source(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "SCRAPERS", {"stubsource": _StubScraper})
    monkeypatch.setattr(
        run_module, "load_basket", lambda: {"city_pairs": [{"origin": "DEL", "destination": "BOM"}]}
    )
    monkeypatch.chdir(tmp_path)

    run_module.run()

    out_files = list((tmp_path / "data" / "raw" / "stubsource").glob("*.jsonl"))
    assert len(out_files) == 1
    lines = out_files[0].read_text().strip().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["total_fare"] == 1234.0
```

```python
# tests/test_sources_registry.py
import json
from pathlib import Path

from scraper.run import SCRAPERS

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "sources.json"


def test_every_wired_scraper_has_an_active_registry_entry():
    registry = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    active_names = {s["name"] for s in registry["sources"] if s["status"] == "active"}
    assert set(SCRAPERS.keys()) <= active_names
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_run.py tests/test_sources_registry.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scraper.run'`

- [ ] **Step 3: Write `scraper/run.py`**

```python
"""CLI entrypoint: run every active scraper across the configured basket (PRD F-1.2)."""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper
from scraper.storage import write_quotes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("scraper.run")

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"

# Only sources with status "active" in config/sources.json are wired here.
# Adding a source later: add its module under scraper/sources/, add one line
# below, and flip its status in sources.json once live-verified.
SCRAPERS = {
    "akasaair": AkasaScraper,
}


def load_basket() -> dict:
    return json.loads((CONFIG_DIR / "basket.json").read_text(encoding="utf-8"))


def run() -> None:
    basket = load_basket()
    guard = ComplianceGuard()
    run_id = uuid.uuid4().hex

    for source_name, scraper_cls in SCRAPERS.items():
        scraper = scraper_cls(guard)
        quotes = []
        for pair in basket["city_pairs"]:
            try:
                quotes.extend(scraper.fetch_quotes(pair["origin"], pair["destination"], run_id))
            except PermissionError as exc:
                # ponytail: only robots.txt disallow is handled per-route here;
                # transient network errors abort the whole run loudly (visible
                # in CI/Actions logs) -- add retry/alerting if scheduled-run
                # reliability becomes an issue (PRD success metric, §10).
                logger.error(
                    "skipping %s-%s on %s: %s", pair["origin"], pair["destination"], source_name, exc
                )
        out_path = write_quotes(quotes, source_name, run_id)
        logger.info("wrote %d quotes for %s to %s", len(quotes), source_name, out_path)


if __name__ == "__main__":
    run()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_run.py tests/test_sources_registry.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite**

Run: `pytest -v`
Expected: PASS (all tests across all tasks so far — 16 tests total)

- [ ] **Step 6: Run the linter**

Run: `ruff check .`
Expected: no errors (fix any import-order or unused-import issues it reports before proceeding)

- [ ] **Step 7: Commit**

```bash
git add scraper/run.py tests/test_run.py tests/test_sources_registry.py
git commit -m "feat: CLI entrypoint wiring the basket to active scrapers"
```

---

### Task 8: CI + scheduled scrape workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/daily-scrape.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements-dev.txt
      - run: ruff check .
      - run: pytest
```

- [ ] **Step 2: Write `.github/workflows/daily-scrape.yml`**

```yaml
name: Daily fare scrape

on:
  schedule:
    - cron: "30 2 * * *"
  workflow_dispatch: {}

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: python -m scraper.run
      - uses: actions/upload-artifact@v4
        with:
          name: raw-fares-${{ github.run_id }}
          path: data/raw/
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/daily-scrape.yml
git commit -m "chore: CI and scheduled-scrape GitHub Actions workflows"
```

- [ ] **Step 4: Verify on GitHub (manual, once a remote exists)**

This repo has no remote configured yet. Once pushed, confirm the Actions tab shows both workflows with valid syntax and that `ci.yml` passes on the push.

---

### Task 9: Live verification (manual, real network)

Every automated test above mocks the network — this task is the one point where the scraper actually talks to the real Akasa endpoint, to confirm the mocks reflect reality.

**Files:**
- Create: `scripts/verify_live.py`

- [ ] **Step 1: Write `scripts/verify_live.py`**

```python
"""Manual live check against the real Akasa Air endpoint. Not part of the
automated test suite (CI must never depend on live network access) -- run
this by hand after any change to scraper/sources/akasa.py or scraper/compliance.py.
"""
from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper

if __name__ == "__main__":
    guard = ComplianceGuard()
    scraper = AkasaScraper(guard)
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="verify-live")
    for q in quotes:
        print(q.advance_window, q.travel_date, q.status, q.total_fare)
```

- [ ] **Step 2: Run it and confirm real data comes back**

Run: `python scripts/verify_live.py`
Expected: 5 lines printed (one per advance window: T+1, T+7, T+15, T+30, T+45), each with a real travel date and a numeric `total_fare` in the low thousands of INR, `status` = `available` (barring an actual sold-out date on Akasa's live system).

- [ ] **Step 3: Commit**

```bash
git add scripts/verify_live.py
git commit -m "chore: manual live-verification script for the Akasa scraper"
```

---

## Definition of done

- `pytest` passes with zero failures and zero live network calls.
- `ruff check .` passes clean.
- `python -m scraper.run` produces `data/raw/akasaair/<run_id>.jsonl` with 15 records (3 city-pairs × 5 advance windows).
- `python scripts/verify_live.py` prints 5 real, current Akasa Air fares for DEL-BOM.
- `config/sources.json` documents all 11 PRD-named sources; `tests/test_sources_registry.py` guarantees `scraper/run.py` never silently scrapes a non-active one.
