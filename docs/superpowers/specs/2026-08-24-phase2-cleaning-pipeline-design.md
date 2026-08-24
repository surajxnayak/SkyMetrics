# SkyMetrics Phase 2 — Cleaning Pipeline Design

Date: 2026-08-24
Status: Approved for implementation

## Context

Phase 1 (and its fare-decomposition upgrade, both shipped) produce raw JSONL under `data/raw/<source>/<run_id>.jsonl` — one file per active source per run, `FareQuote` records with exact fare decomposition, multiple fare-class options per date, and a `routing` field distinguishing genuine nonstops (`routing=None`) from connecting/alternate-airport itineraries (`routing="LEG1|LEG2"`).

The PRD's cleaning stage (§4.2) lists five requirements. Two are already satisfied by Phase 1's raw layer for Akasa and need no new code:
- **F-2.1 (fare decomposition)** — exact, not estimated, since the fare-decomposition upgrade.
- **F-2.5 (currency/schema normalization)** — everything is already INR with a consistent schema.

Three are not yet built and are this phase's actual scope:
- **F-2.2 (outlier removal)**
- **F-2.3 (missing-value handling)**
- **F-2.4 (de-duplication across sources, with provenance retained)**

Two decisions from this session's brainstorming shape the design:
1. **Keep every itinerary** (nonstop and connecting/alternate-airport) — "just like how the real world operates." Nothing gets filtered out of the cleaned dataset; outlier detection treats the full distribution as real, not something to specially exempt by routing type.
2. **Flat files, not a database, for now** — a database becomes genuinely necessary in Phase 3 (index construction), which needs to query across many runs/dates for a time series. Introducing it before there's more than one run's worth of data to store would be premature.

## Goals

- Build de-duplication that collapses genuinely identical fare observations across sources (the mechanism matters now even though only one source is active — more are registered and waiting).
- Build IQR-based outlier flagging, computed per `(origin, destination, advance_window)` — the natural grouping for "is this fare implausible for this route and booking window," across all routing/fare-class types together.
- Handle `no_flight` records without fabricating data — pass through, excluded from numeric outlier math (no `total_fare` to compare), never dropped.
- Never physically discard a record. Outlier detection *flags*; whether to exclude flagged records from the index is Phase 3's decision, not this phase's.

## Non-goals

- No database — flat JSONL in, flat JSONL out.
- No index construction (Phase 3).
- No changes to `scraper/` — this phase only reads its output.
- Cross-source dedup logic is written generically (keyed on carrier, not source) but only exercised by one active source today.

## Cleaned record shape

A new `pipeline/schema.py` defines `CleanedFareQuote` by **composition**, not by duplicating all 18 `FareQuote` fields:

```python
@dataclass(frozen=True)
class CleanedFareQuote:
    quote: FareQuote          # the representative raw quote (first-seen within its dedup group)
    is_outlier: bool
    source_quote_ids: list[str]  # every raw quote_id that collapsed into this record (1 normally)

    def to_json_dict(self) -> dict:
        d = self.quote.to_json_dict()
        d["is_outlier"] = self.is_outlier
        d["source_quote_ids"] = self.source_quote_ids
        return d
```

This avoids the copy-paste-bug risk of re-declaring every field, and keeps "cleaned" genuinely distinct from "raw" as its own small type (matching the PRD's own architecture: separate raw store vs. curated layer) while still serializing to one flat JSON object per line.

## De-duplication (F-2.4)

**Dedup key:** `(carrier, origin, destination, travel_date, advance_window, fare_class, routing, total_fare)` — deliberately keyed on `carrier`, not `source`. The PRD's intent is collapsing the *same underlying fare* observed redundantly through different collection paths (e.g. an airline-direct source and an OTA reselling that airline's inventory reporting the identical flight) — not collapsing two different airlines that happen to charge the same price. `source` is not part of the key; which source(s) reported a duplicate stays fully traceable via `source_quote_ids` pointing back to the raw records.

**Algorithm:** group by the key above (first-seen record per key becomes the representative `quote`); every `quote_id` in a group becomes that record's `source_quote_ids`. Deterministic given the input order (Python dict insertion order), no sorting/tie-breaking logic needed.

**Scope of one dedup pass:** all raw files sharing one `run_id`, across every source directory under `data/raw/`. Dedup operates *within* a run (comparing quotes collected in the same collection cycle), never *across* runs/dates — different days are genuinely different price observations for a price index, not duplicates.

## Outlier detection (F-2.2)

Computed per `(origin, destination, advance_window)` group, using every `status == "available"` record in that group regardless of `fare_class` or `routing` — a connecting itinerary priced higher than a nonstop on the same route/date is part of the same real distribution a traveler sees, not a special case to exempt.

**Method:** IQR (interquartile range), via `statistics.quantiles(fares, n=4)` → `Q1, Q2, Q3`. `IQR = Q3 - Q1`. Bounds: `[Q1 - 1.5*IQR, Q3 + 1.5*IQR]`. Any fare outside the bounds is flagged `is_outlier=True`; everything else `is_outlier=False`.

**Known limitation, documented not hidden:** with only 3 routes × 5 windows, some groups have small sample sizes (single digits to low teens). Small-sample IQR is statistically noisy — acceptable for this prototype's scope (the PRD's own success metric is "<5% flagged," not large-sample statistical rigor), but worth knowing if Phase 3 ever second-guesses a flagged record.

`no_flight` records (no `total_fare`) are excluded from the outlier computation entirely and always get `is_outlier=False` — there's no numeric value to judge as implausible.

## Missing-value handling (F-2.3)

`no_flight` raw records pass through the pipeline unchanged in spirit: they go through dedup (using the same key — two `no_flight` records for the same route/date/window/fare_class=None/routing=None/total_fare=None are genuinely redundant observations and correctly collapse into one) and get `is_outlier=False` from outlier detection. No imputation, no fabricated fare value — "flagged omission," exactly as the PRD allows as an alternative to imputation.

## File layout

```
pipeline/
  schema.py     # CleanedFareQuote
  dedup.py      # dedup_quotes(quotes: list[FareQuote]) -> list[tuple[FareQuote, list[str]]]
  outliers.py   # flag_outliers(quotes) -> dict[quote_id, is_outlier]
  clean.py      # orchestrator: load raw JSONL for a run_id -> dedup -> flag -> write cleaned JSONL
tests/
  test_pipeline_schema.py
  test_dedup.py
  test_outliers.py
  test_clean.py
data/
  cleaned/<run_id>.jsonl   # gitignored, same convention as data/raw/
```

`pipeline/clean.py` takes a `run_id`, globs `data/raw/*/<run_id>.jsonl` (every source's output for that run — today just `akasaair`, generically ready for more), loads every `FareQuote`, dedups, flags outliers, writes `data/cleaned/<run_id>.jsonl`.

## Testing

Same convention as `scraper/`: `pytest`, no live network (this phase never touches the network at all — pure transformation over already-collected JSONL), fixtures built from real `FareQuote` construction rather than raw dicts. `pipeline/clean.py`'s file-discovery logic gets a test using `tmp_path` fixtures mimicking `data/raw/<source>/<run_id>.jsonl`, same pattern Phase 1 used for `scraper/storage.py` and `scraper/run.py`.

## Known limitation (flagged during Task 2 review, not fixed here)

`FareQuote` has no flight-number or departure-time field, so the dedup key (carrier/origin/destination/travel_date/advance_window/fare_class/routing/total_fare) cannot distinguish two genuinely different nonstop flights on the same route/date that happen to share a fare bucket and price — they would collapse into one record. Confirmed not a defect *introduced* by dedup: it's a pre-existing schema granularity limit, and not confirmed to actually occur in this basket's real data (unlike the earlier `fee_breakdown` bug, which had measured, concrete real-data impact).

Confirmed this is fixable later: Akasa's search response has a separate `data.results[].trips[].journeysAvailableByMarket[].value[].fares[]` tree carrying real flight-level detail (flight number via `segments[].identifier.identifier`, e.g. `"2018"`; departure/arrival times; `flightType`), cross-referenceable back to `data.faresAvailable[]` via the shared `fareAvailabilityKey`. Adding `flight_number`/`departure_time` to `FareQuote` and the dedup key would close this gap — deferred as a follow-up to the Akasa scraper (not this cleaning-pipeline phase), since it requires parsing a second, independent part of the response.
