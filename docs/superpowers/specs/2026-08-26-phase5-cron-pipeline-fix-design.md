# SkyMetrics Phase 5 — Cron Pipeline Fix Design

Date: 2026-08-26
Status: Approved for implementation

## Context

Phase 5 (PRD §9: "Back-test vs DGCA + docs + tests") needs real, multi-day APIx
history to back-test meaningfully. Today only one calendar day of cleaned/index
data exists (2026-08-24). `.github/workflows/daily-scrape.yml` already runs on a
daily schedule via GitHub Actions, but only invokes `python -m scraper.run` —
it never runs `pipeline.clean` or `index.build`, and nothing it produces is
persisted anywhere durable (raw quotes go to a short-lived build artifact,
`data/cleaned/` and `data/index/` are gitignored). So the cron, as it stands,
cannot actually accumulate index history even though it fires every day.

The PRD itself (§9) explicitly permits back-testing with "whatever live-collection
days are available" and documenting that limitation transparently — so this fix
is not a hard blocker for Phase 5. It's still worth doing because (a) the cron's
current behavior doesn't match what "automated daily collection" should mean —
that's an existing gap, not a hypothetical one — and (b) every day between now
and submission that the fix is live adds one more real data point to the
back-test, at effectively zero ongoing cost once it's wired up.

## Goals

- Extend the daily cron to actually produce a new index snapshot each day:
  scrape → clean → build, not just scrape.
- Persist `data/cleaned/` and `data/index/` durably across runs by committing
  them to the repo — GitHub Actions runners are ephemeral, so committing is
  the only way history survives between runs without adding new infrastructure.
- Bootstrap day 1 using the real 2026-08-24 data already produced and verified
  locally during Phases 1-4, instead of starting from zero.

## Non-goals

- No database, no Docker. Both are deliberately deferred until after the
  proof-of-concept is validated (separate decision, not part of this fix).
- No change to `data/raw/` handling — stays gitignored, its artifact upload is
  unchanged. Raw quotes are ephemeral inputs; cleaned/index data is the durable
  output that matters.
- No retry/alerting on scrape failure. A hard failure in `scraper.run` (not a
  per-route `PermissionError`, which is already caught and logged) fails the
  step and GitHub Actions stops the job before clean/build/commit run — this
  matches the project's existing fail-loud convention and needs no new code.
- No cross-run dedup changes. `pipeline.clean` and `index.build` behave exactly
  as they do today; this fix only wires them into the schedule.

## Design

### Workflow changes (`.github/workflows/daily-scrape.yml`)

- Add `permissions: contents: write` at the job level (needed for the push step).
- Capture the scrape step's `run_id` via stdout into `$GITHUB_OUTPUT`. This
  requires one small change to `scraper/run.py`: `run()` returns `run_id`
  instead of returning nothing, and the `__main__` block prints it
  (`print(run())`). Logging already goes to stderr by default
  (`logging.basicConfig()`'s default stream), so a trailing `print()` gives a
  clean, single-line value on stdout for the workflow step to capture — no
  existing log output needs to change.
- Add a `Clean` step: `python -c "from pipeline.clean import clean_run; clean_run('${{ steps.scrape.outputs.run_id }}')"`.
- Add a `Build index` step: `python -m index.build`.
- Add a `Commit new data` step: configure a bot git identity
  (`github-actions[bot]` / `github-actions[bot]@users.noreply.github.com`),
  `git add data/cleaned data/index`, commit only if there's a staged diff
  (`git diff --staged --quiet || git commit -m "chore: daily fare data $(date -u +%Y-%m-%d)"`),
  then `git pull --rebase` followed by `git push` — the rebase guards against
  the rare case of another push landing on `main` between checkout and push.
- The existing raw-artifact upload step is unchanged.

### `.gitignore`

Remove the `data/cleaned/` and `data/index/` lines (lines 9-10). `data/raw/`
stays ignored.

### One-time bootstrap

As part of landing this change (not the automated workflow itself), commit the
local `data/cleaned/` and `data/index/` files already produced and verified
during Phases 1-4 (2026-08-24's data), so the committed history starts from
real data rather than waiting for the next cron fire.

## Testing / Verification plan

Same "verify against real data" discipline as every prior phase:

1. Run the new scrape → clean → build → commit sequence locally end-to-end
   (against a throwaway branch or a local-only commit) and confirm it produces
   a new `data/cleaned/<run_id>.jsonl` and a new `data/index/<comparison_id>.json`.
2. Confirm `scraper/run.py`'s existing tests still pass after the `run()`
   return-value change (it's an additive change — returning a value it
   previously discarded — so no existing test should need to change, but this
   is verified, not assumed).
3. Push the workflow change, then trigger it for real via `workflow_dispatch`
   (`gh workflow run daily-scrape.yml` + `gh run watch`) and confirm the run
   actually completes all steps and the push to `main` succeeds — not just
   that the YAML looks right.
4. Confirm CI (`ci.yml`) still passes after `data/cleaned/`/`data/index/`
   become tracked (no test currently assumes those paths are gitignored, but
   this is verified rather than assumed).
