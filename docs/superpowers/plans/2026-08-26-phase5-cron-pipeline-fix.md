# Phase 5 Cron Pipeline Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing daily GitHub Actions cron actually produce and persist a new APIx index snapshot each day, instead of only scraping raw quotes that get discarded after a short-lived artifact upload.

**Architecture:** `scraper.run()` is changed to return the `run_id` it generates, so the workflow can capture it and feed it to `pipeline.clean.clean_run()`, followed by `index.build`. The daily workflow gains steps for clean, build, and a git commit/push of the results. `data/cleaned/` and `data/index/` are un-gitignored so they can be committed; `data/raw/` stays ignored (unchanged, still ephemeral-artifact-only). The two cleaned-data files and one index snapshot already produced locally during Phases 1-4 are committed as a one-time bootstrap so history starts from real, already-verified data.

**Tech Stack:** Python 3.11 stdlib (no new dependencies), GitHub Actions YAML, git.

---

### Task 1: `scraper.run()` returns its `run_id`

**Files:**
- Modify: `scraper/run.py:30-58`
- Test: `tests/test_run.py`

- [ ] **Step 1: Write the failing test**

Add this test to `tests/test_run.py` (it reuses the existing `_StubScraper` and
`load_basket` monkeypatch pattern already in the file):

```python
def test_run_returns_the_run_id_used_for_quotes(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "SCRAPERS", {"stubsource": _StubScraper})
    monkeypatch.setattr(
        run_module, "load_basket", lambda: {"city_pairs": [{"origin": "DEL", "destination": "BOM"}]}
    )
    monkeypatch.chdir(tmp_path)

    run_id = run_module.run()

    out_files = list((tmp_path / "data" / "raw" / "stubsource").glob("*.jsonl"))
    assert len(out_files) == 1
    assert out_files[0].stem == run_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_run.py::test_run_returns_the_run_id_used_for_quotes -v`
Expected: FAIL — `assert out_files[0].stem == run_id` fails because `run_id` is
`None` (current `run()` has no `return` statement).

- [ ] **Step 3: Change `run()` to return `run_id`, and print it in `__main__`**

In `scraper/run.py`, change the function signature and add a return statement
(the body of the loop is unchanged):

```python
def run() -> str:
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
                    "skipping %s-%s on %s: %s",
                    pair["origin"],
                    pair["destination"],
                    source_name,
                    exc,
                )
        out_path = write_quotes(quotes, source_name, run_id)
        logger.info("wrote %d quotes for %s to %s", len(quotes), source_name, out_path)
    return run_id


if __name__ == "__main__":
    print(run())
```

This changes two things from the current file: the `-> None` return
annotation becomes `-> str`, a `return run_id` is added at the end of `run()`,
and the `__main__` block calls `print(run())` instead of a bare `run()`.
Logging already goes to stderr by default (`logging.basicConfig()`'s default
stream), so this `print()` is the only thing that reaches stdout — safe to
capture from a shell step.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_run.py -v`
Expected: all tests in the file PASS, including the two pre-existing tests
(`test_run_writes_quotes_for_each_configured_source`,
`test_run_skips_failing_routes_and_keeps_successful_ones`) — this change is
additive (a function that returned nothing now returns something), so neither
existing test should need modification.

- [ ] **Step 5: Run the full test suite and lint**

Run: `pytest && ruff check .`
Expected: all tests pass, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add scraper/run.py tests/test_run.py
git commit -m "feat: scraper.run() returns its run_id for pipeline chaining"
```

---

### Task 2: Un-gitignore cleaned and index data

**Files:**
- Modify: `.gitignore:9-10`

- [ ] **Step 1: Remove the two lines**

In `.gitignore`, delete these two lines (currently lines 9-10):

```
data/cleaned/
data/index/
```

`data/raw/` (line 8) and every other line stay unchanged.

- [ ] **Step 2: Verify the files are now visible to git**

Run: `git status`
Expected: `data/cleaned/352caab5a07b44e3946eb6c1b3d87db8.jsonl`,
`data/cleaned/e03e1b5a37e5460ea29daec421d2cc86.jsonl`, and
`data/index/3f7431f401454339b39bb5345734f840.json` now appear as untracked
files (they were previously hidden by the gitignore rules just removed).

- [ ] **Step 3: Commit the `.gitignore` change on its own**

```bash
git add .gitignore
git commit -m "chore: track data/cleaned and data/index instead of ignoring them"
```

Committing this separately from the data files themselves (next task) keeps
the history readable — "this is a policy change" vs. "this is the data".

---

### Task 3: Bootstrap-commit the existing local data

**Files:**
- Add: `data/cleaned/352caab5a07b44e3946eb6c1b3d87db8.jsonl`
- Add: `data/cleaned/e03e1b5a37e5460ea29daec421d2cc86.jsonl`
- Add: `data/index/3f7431f401454339b39bb5345734f840.json`

- [ ] **Step 1: Confirm there's no unexpected content**

Run: `head -c 500 data/cleaned/352caab5a07b44e3946eb6c1b3d87db8.jsonl data/cleaned/e03e1b5a37e5460ea29daec421d2cc86.jsonl data/index/3f7431f401454339b39bb5345734f840.json`
Expected: fare-quote JSON records / an index snapshot JSON document — no
unexpected fields. (Fare records have no PII per the PRD's own data
minimisation section, §5.3 — already confirmed in the Phase 5 design spec.)

- [ ] **Step 2: Commit them**

```bash
git add data/cleaned data/index
git commit -m "chore: bootstrap committed history with existing 2026-08-24 fare data"
```

---

### Task 4: Wire clean + build + commit into the daily workflow

**Files:**
- Modify: `.github/workflows/daily-scrape.yml`

- [ ] **Step 1: Replace the workflow file contents**

Replace the entire contents of `.github/workflows/daily-scrape.yml` with:

```yaml
name: Daily fare scrape

on:
  schedule:
    - cron: "30 2 * * *"
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - id: scrape
        run: echo "run_id=$(python -m scraper.run)" >> "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@v4
        with:
          name: raw-fares-${{ github.run_id }}
          path: data/raw/
      - run: python -c "from pipeline.clean import clean_run; clean_run('${{ steps.scrape.outputs.run_id }}')"
      - run: python -m index.build
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/cleaned data/index
          git diff --staged --quiet || git commit -m "chore: daily fare data $(date -u +%Y-%m-%d)"
          git pull --rebase
          git push
```

What changed from the current file: added `permissions: contents: write`;
the scrape step gained `id: scrape` and now captures its printed `run_id`
into `$GITHUB_OUTPUT`; the raw-artifact upload step is unchanged and stays
immediately after scraping (so it still runs even if a later step fails);
three new steps run clean, build, and the commit/push.

- [ ] **Step 2: Validate the YAML is well-formed**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/daily-scrape.yml'))"`
Expected: no output, no exception (exit code 0). This only checks syntax, not
GitHub Actions semantics — Task 5 verifies actual behavior.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-scrape.yml
git commit -m "feat: wire clean + build + commit into the daily scrape cron"
```

---

### Task 5: Verify the full sequence end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Confirm `pytest` still passes with the new files tracked**

Run: `pytest`
Expected: all tests pass (same count as before this plan started, plus the
one new test from Task 1).

- [ ] **Step 2: Dry-run the scrape → clean → build sequence locally**

Run:

```bash
run_id=$(python -m scraper.run)
python -c "from pipeline.clean import clean_run; clean_run('$run_id')"
python -m index.build
```

Expected: a new `data/cleaned/$run_id.jsonl` file appears, and a new
`data/index/<comparison_id>.json` file appears in `data/index/` (a fresh
`comparison_id`, distinct from the bootstrapped one from Task 3). This is a
real scrape against the live, robots.txt-compliant Akasa source — consistent
with how every prior phase in this project was verified.

- [ ] **Step 3: Commit this real local verification run's output**

```bash
git add data/cleaned data/index
git commit -m "chore: local verification run of the clean+build pipeline"
```

- [ ] **Step 4: Push everything from this plan**

```bash
git push
```

- [ ] **Step 5: Trigger the workflow for real and watch it run**

Run: `gh workflow run daily-scrape.yml && gh run watch`
Expected: the run completes with a green checkmark on every step, including
the final commit/push step. If the push step fails (e.g. nothing to commit
because Step 2-4 above already captured today's data), re-run
`gh run view --log` on that run and confirm the failure is specifically the
`git diff --staged --quiet ||` guard correctly finding no changes to commit —
not an unrelated failure.

- [ ] **Step 6: Confirm the pushed commit is visible**

Run: `git log --oneline -5`
Expected: if the workflow run in Step 5 found new data to commit, its
`chore: daily fare data <date>` commit appears at the top after a
`git pull`. If it found nothing new (same-day re-run), no new commit is
expected — that's correct behavior, not a bug.

---

## Self-review notes

- **Spec coverage:** every section of the design spec maps to a task —
  workflow changes (Task 4), `.gitignore` (Task 2), bootstrap (Task 3),
  `run_id` capture mechanism (Task 1), verification plan (Task 5, covering
  all four of the spec's verification points).
- **No placeholders:** every step has literal file paths, literal code, and
  literal commands with stated expected output.
- **Type/signature consistency:** `run()`'s new `-> str` return type (Task 1)
  is the exact value Task 4's workflow YAML captures via
  `echo "run_id=$(python -m scraper.run)"` — the printed stdout value is the
  returned `run_id` string, nothing else is printed to stdout to conflict
  with it.
