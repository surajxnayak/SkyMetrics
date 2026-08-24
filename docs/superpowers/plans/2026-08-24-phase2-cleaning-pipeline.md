# Phase 2 Cleaning Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cleaning pipeline's three not-yet-solved requirements (de-duplication, outlier flagging, missing-value pass-through) as a new `pipeline/` package that reads raw JSONL and writes cleaned JSONL — no database, no network, no changes to `scraper/`.

**Architecture:** `pipeline/dedup.py` collapses genuinely identical fare observations (keyed on carrier, not source) with provenance retained. `pipeline/outliers.py` computes IQR bounds per `(origin, destination, advance_window)` and flags (never deletes) implausible fares. `pipeline/schema.py` defines `CleanedFareQuote` by composing a `FareQuote` with cleaning metadata rather than duplicating its 18 fields. `pipeline/clean.py` orchestrates: load every source's raw file for a run_id → dedup → flag → write one cleaned JSONL.

**Tech Stack:** Same as Phase 1 — stdlib only (`statistics`, `json`, `pathlib`, `datetime`), `pytest` for tests, `ruff` for lint.

**Reference:** `docs/superpowers/specs/2026-08-24-phase2-cleaning-pipeline-design.md` for the full rationale (why carrier-keyed dedup, why IQR-per-route-window, why flag-not-delete, why flat files).

---

### Task 1: `CleanedFareQuote` schema + package setup

**Files:**
- Create: `pipeline/__init__.py`
- Create: `pipeline/schema.py`
- Create: `tests/test_pipeline_schema.py`
- Modify: `.gitignore`

- [ ] **Step 1: Create the package marker and add a cleaned-data ignore rule**

```bash
mkdir -p pipeline
touch pipeline/__init__.py
```

Add `data/cleaned/` to `.gitignore` (it currently ends with `.DS_Store` after `data/raw/` and `.env`):

```
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/
.pytest_cache/
.ruff_cache/
data/raw/
data/cleaned/
.env
.DS_Store
```

- [ ] **Step 2: Write the failing tests**

```python
# tests/test_pipeline_schema.py
from datetime import date, datetime, timezone

from pipeline.schema import CleanedFareQuote
from scraper.schema import FareQuote, new_quote_id


def _quote(**overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class="T0",
        base_fare=5985.0,
        taxes=306.0,
        udf=152.0,
        convenience_fee=800.0,
        total_fare=7243.0,
        status="available",
        run_id="run-1",
        fee_breakdown={"FarePrice": 5985.0},
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_to_json_dict_includes_quote_fields_and_cleaning_metadata():
    quote = _quote()
    cleaned = CleanedFareQuote(quote=quote, is_outlier=False, source_quote_ids=[quote.quote_id])

    d = cleaned.to_json_dict()

    assert d["origin"] == "DEL"
    assert d["total_fare"] == 7243.0
    assert d["is_outlier"] is False
    assert d["source_quote_ids"] == [quote.quote_id]


def test_is_outlier_can_be_true():
    quote = _quote()
    cleaned = CleanedFareQuote(quote=quote, is_outlier=True, source_quote_ids=[quote.quote_id])
    assert cleaned.to_json_dict()["is_outlier"] is True


def test_source_quote_ids_can_list_multiple_ids():
    quote = _quote()
    cleaned = CleanedFareQuote(quote=quote, is_outlier=False, source_quote_ids=["a", "b"])
    assert cleaned.to_json_dict()["source_quote_ids"] == ["a", "b"]
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_pipeline_schema.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.schema'`

- [ ] **Step 4: Write `pipeline/schema.py`**

```python
"""Cleaned fare record: a raw FareQuote plus cleaning-stage metadata (PRD §4.2).

Composes a FareQuote rather than re-declaring its 18 fields, to avoid the
copy-paste-bug risk of keeping two parallel field lists in sync.
"""
from __future__ import annotations

from dataclasses import dataclass

from scraper.schema import FareQuote


@dataclass(frozen=True)
class CleanedFareQuote:
    quote: FareQuote
    is_outlier: bool
    source_quote_ids: list[str]

    def to_json_dict(self) -> dict:
        d = self.quote.to_json_dict()
        d["is_outlier"] = self.is_outlier
        d["source_quote_ids"] = self.source_quote_ids
        return d
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_pipeline_schema.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS (35 tests: 32 existing + 3 new)

- [ ] **Step 7: Commit**

```bash
git add pipeline/__init__.py pipeline/schema.py tests/test_pipeline_schema.py .gitignore
git commit -m "feat: CleanedFareQuote schema for the cleaning pipeline"
```

---

### Task 2: De-duplication

**Files:**
- Create: `pipeline/dedup.py`
- Create: `tests/test_dedup.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_dedup.py
from datetime import date, datetime, timezone

from pipeline.dedup import dedup_quotes
from scraper.schema import FareQuote, new_quote_id


def _quote(**overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class="T0",
        base_fare=5985.0,
        taxes=306.0,
        udf=152.0,
        convenience_fee=800.0,
        total_fare=7243.0,
        status="available",
        run_id="run-1",
        fee_breakdown=None,
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_distinct_quotes_are_not_collapsed():
    a = _quote(fare_class="T0", total_fare=7243.0)
    b = _quote(fare_class="U1", total_fare=6968.0)

    result = dedup_quotes([a, b])

    assert len(result) == 2


def test_identical_quotes_from_different_sources_collapse_with_provenance():
    a = _quote(source="akasaair")
    b = _quote(source="akasaair_via_partner")

    result = dedup_quotes([a, b])

    assert len(result) == 1
    representative, source_quote_ids = result[0]
    assert representative.quote_id == a.quote_id
    assert source_quote_ids == [a.quote_id, b.quote_id]


def test_different_carriers_with_the_same_price_are_not_collapsed():
    a = _quote(carrier="QP", total_fare=7243.0)
    b = _quote(carrier="6E", total_fare=7243.0)

    result = dedup_quotes([a, b])

    assert len(result) == 2


def test_no_flight_quotes_for_the_same_slot_collapse_too():
    no_flight_kwargs = dict(
        status="no_flight",
        fare_class=None,
        total_fare=None,
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
    )
    a = _quote(**no_flight_kwargs)
    b = _quote(**no_flight_kwargs)

    result = dedup_quotes([a, b])

    assert len(result) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_dedup.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.dedup'`

- [ ] **Step 3: Write `pipeline/dedup.py`**

```python
"""De-duplicate fare quotes collected within one run (PRD F-2.4).

Keyed on carrier, not source: the goal is collapsing the same underlying
fare observed redundantly through different collection paths (e.g. an
airline-direct source and an OTA reselling that airline's inventory
reporting the identical flight) -- not collapsing two different airlines
that happen to charge the same price. Dedup operates within one run only;
different days are genuinely different price observations, not duplicates.
"""
from __future__ import annotations

from scraper.schema import FareQuote


def _dedup_key(quote: FareQuote) -> tuple:
    return (
        quote.carrier,
        quote.origin,
        quote.destination,
        quote.travel_date,
        quote.advance_window,
        quote.fare_class,
        quote.routing,
        quote.total_fare,
    )


def dedup_quotes(quotes: list[FareQuote]) -> list[tuple[FareQuote, list[str]]]:
    groups: dict[tuple, list[FareQuote]] = {}
    for quote in quotes:
        groups.setdefault(_dedup_key(quote), []).append(quote)

    return [(group[0], [q.quote_id for q in group]) for group in groups.values()]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_dedup.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (39 tests: 35 from Task 1 + 4 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add pipeline/dedup.py tests/test_dedup.py
git commit -m "feat: carrier-keyed de-duplication with provenance"
```

---

### Task 3: Outlier flagging

**Files:**
- Create: `pipeline/outliers.py`
- Create: `tests/test_outliers.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_outliers.py
from datetime import date, datetime, timezone

from pipeline.outliers import flag_outliers
from scraper.schema import FareQuote, new_quote_id


def _quote(total_fare, **overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class="T0",
        base_fare=None,
        taxes=None,
        udf=None,
        convenience_fee=None,
        total_fare=total_fare,
        status="available",
        run_id="run-1",
        fee_breakdown=None,
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_flags_a_clear_outlier_within_a_group():
    quotes = [
        _quote(6500.0),
        _quote(6600.0),
        _quote(6700.0),
        _quote(6800.0),
        _quote(6900.0),
        _quote(50000.0),
    ]

    flags = flag_outliers(quotes)

    assert flags[quotes[-1].quote_id] is True
    assert all(flags[q.quote_id] is False for q in quotes[:-1])


def test_does_not_flag_a_tight_cluster():
    quotes = [_quote(6500.0), _quote(6550.0), _quote(6600.0), _quote(6650.0), _quote(6700.0)]

    flags = flag_outliers(quotes)

    assert all(flags[q.quote_id] is False for q in quotes)


def test_groups_are_independent_by_route_and_window():
    cheap_route = [_quote(1000.0, destination="BLR") for _ in range(4)]
    expensive_route = [_quote(50000.0, destination="HYD") for _ in range(4)]

    flags = flag_outliers(cheap_route + expensive_route)

    assert all(flags[q.quote_id] is False for q in cheap_route)
    assert all(flags[q.quote_id] is False for q in expensive_route)


def test_small_groups_are_not_flagged():
    quotes = [_quote(1000.0), _quote(50000.0)]

    flags = flag_outliers(quotes)

    assert all(flags[q.quote_id] is False for q in quotes)


def test_no_flight_quotes_are_never_flagged():
    quote = _quote(None, status="no_flight", fare_class=None)

    flags = flag_outliers([quote])

    assert flags[quote.quote_id] is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_outliers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.outliers'`

- [ ] **Step 3: Write `pipeline/outliers.py`**

```python
"""Flag statistically implausible fares within a route/window group (PRD F-2.2).

IQR bounds are computed per (origin, destination, advance_window), across
every routing/fare-class type together -- a connecting itinerary priced
higher than a nonstop on the same route/date is part of the same real
distribution a traveler sees, not a special case to exempt.

# ponytail: small-sample IQR is statistically noisy with only a handful of
# fares per group (this basket has 3 routes x 5 windows); acceptable for
# this prototype's scope, revisit if a larger basket makes it matter.
"""
from __future__ import annotations

import statistics

from scraper.schema import FareQuote

MIN_GROUP_SIZE_FOR_QUARTILES = 4


def flag_outliers(quotes: list[FareQuote]) -> dict[str, bool]:
    groups: dict[tuple, list[FareQuote]] = {}
    for quote in quotes:
        if quote.status != "available" or quote.total_fare is None:
            continue
        key = (quote.origin, quote.destination, quote.advance_window)
        groups.setdefault(key, []).append(quote)

    flags: dict[str, bool] = {quote.quote_id: False for quote in quotes}

    for group in groups.values():
        if len(group) < MIN_GROUP_SIZE_FOR_QUARTILES:
            continue
        fares = sorted(q.total_fare for q in group)
        q1, _, q3 = statistics.quantiles(fares, n=4)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        for quote in group:
            flags[quote.quote_id] = not (lower <= quote.total_fare <= upper)

    return flags
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_outliers.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (44 tests: 39 from Task 2 + 5 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add pipeline/outliers.py tests/test_outliers.py
git commit -m "feat: IQR-based outlier flagging per route and advance window"
```

---

### Task 4: Cleaning orchestrator

**Files:**
- Create: `pipeline/clean.py`
- Create: `tests/test_clean.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_clean.py
import json
from datetime import date, datetime, timezone

from pipeline.clean import clean_run, load_run_quotes
from scraper.schema import FareQuote, new_quote_id
from scraper.storage import write_quotes


def _quote(**overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class="T0",
        base_fare=5985.0,
        taxes=306.0,
        udf=152.0,
        convenience_fee=800.0,
        total_fare=7243.0,
        status="available",
        run_id="run-1",
        fee_breakdown=None,
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_load_run_quotes_reads_across_source_directories(tmp_path):
    write_quotes([_quote(source="akasaair")], source="akasaair", run_id="run-1", base_dir=tmp_path)
    write_quotes([_quote(source="otherair")], source="otherair", run_id="run-1", base_dir=tmp_path)

    quotes = load_run_quotes("run-1", raw_base_dir=tmp_path)

    assert len(quotes) == 2
    assert {q.source for q in quotes} == {"akasaair", "otherair"}


def test_load_run_quotes_ignores_other_run_ids(tmp_path):
    write_quotes([_quote()], source="akasaair", run_id="run-1", base_dir=tmp_path)
    write_quotes([_quote()], source="akasaair", run_id="run-2", base_dir=tmp_path)

    quotes = load_run_quotes("run-1", raw_base_dir=tmp_path)

    assert len(quotes) == 1


def test_clean_run_writes_deduped_flagged_output(tmp_path):
    raw_dir = tmp_path / "raw"
    cleaned_dir = tmp_path / "cleaned"
    duplicate_a = _quote(total_fare=7000.0)
    duplicate_b = _quote(total_fare=7000.0)
    write_quotes([duplicate_a, duplicate_b], source="akasaair", run_id="run-1", base_dir=raw_dir)

    out_path = clean_run("run-1", raw_base_dir=raw_dir, cleaned_base_dir=cleaned_dir)

    assert out_path == cleaned_dir / "run-1.jsonl"
    lines = out_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["is_outlier"] is False
    assert sorted(record["source_quote_ids"]) == sorted([duplicate_a.quote_id, duplicate_b.quote_id])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_clean.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.clean'`

- [ ] **Step 3: Write `pipeline/clean.py`**

```python
"""Cleaning orchestrator: load one run's raw quotes across every source,
dedup, flag outliers, write cleaned JSONL (PRD §4.2)."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from pipeline.dedup import dedup_quotes
from pipeline.outliers import flag_outliers
from pipeline.schema import CleanedFareQuote
from scraper.schema import FareQuote

RAW_BASE_DIR = Path("data/raw")
CLEANED_BASE_DIR = Path("data/cleaned")


def _quote_from_dict(record: dict) -> FareQuote:
    record = dict(record)
    record["travel_date"] = date.fromisoformat(record["travel_date"])
    record["collected_at"] = datetime.fromisoformat(record["collected_at"])
    return FareQuote(**record)


def load_run_quotes(run_id: str, raw_base_dir: Path = RAW_BASE_DIR) -> list[FareQuote]:
    quotes = []
    for source_dir in sorted(raw_base_dir.glob("*")):
        raw_file = source_dir / f"{run_id}.jsonl"
        if not raw_file.exists():
            continue
        with raw_file.open(encoding="utf-8") as f:
            for line in f:
                quotes.append(_quote_from_dict(json.loads(line)))
    return quotes


def clean_run(
    run_id: str,
    raw_base_dir: Path = RAW_BASE_DIR,
    cleaned_base_dir: Path = CLEANED_BASE_DIR,
) -> Path:
    quotes = load_run_quotes(run_id, raw_base_dir)
    deduped = dedup_quotes(quotes)
    representative_quotes = [quote for quote, _ in deduped]
    outlier_flags = flag_outliers(representative_quotes)

    cleaned_quotes = [
        CleanedFareQuote(
            quote=quote,
            is_outlier=outlier_flags[quote.quote_id],
            source_quote_ids=source_quote_ids,
        )
        for quote, source_quote_ids in deduped
    ]

    cleaned_base_dir.mkdir(parents=True, exist_ok=True)
    out_path = cleaned_base_dir / f"{run_id}.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for cleaned in cleaned_quotes:
            f.write(json.dumps(cleaned.to_json_dict()) + "\n")
    return out_path
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_clean.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and linter**

Run: `pytest -v`
Expected: PASS (47 tests: 44 from Task 3 + 3 new)

Run: `ruff check .`
Expected: no errors

- [ ] **Step 6: Run against real, already-collected data**

Find the most recent real raw run already sitting under `data/raw/akasaair/` (from earlier live scraper runs in this project):

```bash
ls -t data/raw/akasaair/*.jsonl | head -1
```

Take the filename without `.jsonl` as `<run_id>`, then run:

```bash
python3 -c "
from pipeline.clean import clean_run
out_path = clean_run('<run_id>')
print('wrote', out_path)
"
```

Then inspect the output:

```bash
python3 -c "
import json
records = [json.loads(l) for l in open('data/cleaned/<run_id>.jsonl')]
outliers = [r for r in records if r['is_outlier']]
multi_source = [r for r in records if len(r['source_quote_ids']) > 1]
print(f'cleaned records: {len(records)}')
print(f'flagged outliers: {len(outliers)}')
print(f'records with >1 source_quote_id (deduped): {len(multi_source)}')
"
```

Expected: a cleaned file is written, `cleaned records` is less than or equal to the raw record count (dedup may have collapsed some), and the outlier count is small relative to the total (the PRD's own success metric target is under 5%, though don't hard-fail on this for a small real dataset — report what you actually see).

- [ ] **Step 7: Commit**

```bash
git add pipeline/clean.py tests/test_clean.py
git commit -m "feat: cleaning orchestrator (load, dedup, flag, write)"
```

---

## Definition of done

- `pytest -v` passes with 47 tests, zero live network calls (this phase never touches the network — pure transformation over already-collected JSONL).
- `ruff check .` passes clean.
- Running `pipeline.clean.clean_run(run_id)` against a real raw run (already on disk from earlier scraper runs) produces `data/cleaned/<run_id>.jsonl` with sane dedup and outlier-flag counts, inspected by hand.
- `config/sources.json`, `scraper/`, and everything else from Phase 1 remain untouched — this phase only reads `scraper/schema.py`'s `FareQuote` and `scraper/storage.py`'s `write_quotes` (in tests only).
