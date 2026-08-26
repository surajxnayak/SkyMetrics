# README Documentation (Phase 5 docs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `README.md` with `## Architecture` and `## Methodology` sections so a reader (e.g. a hackathon judge) can understand how SkyMetrics is built and what its index numbers mean, without reading source code.

**Architecture:** Pure documentation change — insert two new Markdown sections into the existing `README.md`, between the current `## Status` section and the current `## Why only one live source right now` section. No code changes, no new files other than this plan.

**Tech Stack:** Markdown only.

---

This is a documentation-only plan — there is no code to test with `pytest`/`vitest`. Each
task's "verification" step is a fact-check: re-reading the real source file each claim is
based on and confirming the new README text matches it exactly, per the spec's
"Verification" section.

### Task 1: Add `## Architecture` section to README.md

**Files:**
- Modify: `README.md` (insert after line 32, before line 33 — see below)

The current end of the `## Status` section and start of `## Why only one live source
right now` looks like this (README.md lines 29-34):

```markdown
Data storage moved from git-committed flat files to PostgreSQL, packaged
with Docker Compose — see
`docs/superpowers/specs/2026-08-26-postgres-docker-design.md`.

## Why only one live source right now
```

- [ ] **Step 1: Verify the source facts before writing**

Run these two commands and confirm the output matches what Step 2 below claims:

```bash
ls scraper/ pipeline/ index/ api/ dashboard/ db/ config/ docs/
grep -n "^def \|^async def " api/main.py | head -5
```

Expected: `scraper/run.py`, `pipeline/clean.py`, `index/build.py`, `api/main.py`, and a
`dashboard/` directory all exist, matching Step 2's diagram.

- [ ] **Step 2: Insert the Architecture section**

Using the Edit tool, replace this exact text in `README.md`:

```markdown
Data storage moved from git-committed flat files to PostgreSQL, packaged
with Docker Compose — see
`docs/superpowers/specs/2026-08-26-postgres-docker-design.md`.

## Why only one live source right now
```

with this exact text:

````markdown
Data storage moved from git-committed flat files to PostgreSQL, packaged
with Docker Compose — see
`docs/superpowers/specs/2026-08-26-postgres-docker-design.md`.

## Architecture

```
Akasa Air
    |
    v
scraper/run.py            (writes data/raw/*.jsonl, gitignored, ephemeral)
    |
    v
pipeline/clean.py   ----> PostgreSQL: fare_quotes
    |
    v
index/build.py      ----> PostgreSQL: index_points
                                |
                                v
                          api/main.py (FastAPI REST, api/data_access.py reads both tables)
                                |
                                v
                          dashboard/ (React + TypeScript, consumes the REST API)
```

| Directory   | Responsibility                                                  |
|-------------|------------------------------------------------------------------|
| `scraper/`  | Akasa Air scraper + compliance guard (robots.txt, rate limiting) |
| `pipeline/` | Cleaning: de-duplication, IQR outlier flagging                   |
| `index/`    | Index construction: formulas, weights, build, back-test          |
| `api/`      | FastAPI REST layer + Postgres data access                        |
| `dashboard/`| React + TypeScript dashboard                                     |
| `db/`       | Postgres schema + migration scripts                               |
| `config/`   | Source compliance audit, route weights                            |
| `docs/`     | Specs, plans, validation report                                   |

## Why only one live source right now
````

- [ ] **Step 3: Verify the section renders correctly**

Run:

```bash
sed -n '/^## Architecture$/,/^## Why only one live source/p' README.md
```

Expected: the fenced ASCII diagram and the file-map table print exactly as written above,
with no broken fences (the diagram must be wrapped in its own triple-backtick fence,
separate from the surrounding Markdown, so GitHub renders it as a code block).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Architecture section to README"
```

### Task 2: Add `## Methodology` section to README.md

**Files:**
- Modify: `README.md` (insert immediately after the `## Architecture` section added in
  Task 1, before `## Why only one live source right now`)

- [ ] **Step 1: Verify the source facts before writing**

Run these two commands and confirm the output matches what Step 2 below claims:

```bash
cat index/formulas.py
cat config/weights.json
```

Expected: `index/formulas.py` defines `simple_relative`, `laspeyres`, `paasche`, and
`fisher` with the docstring explaining Laspeyres is a weighted arithmetic mean and
Paasche a weighted harmonic mean, diverging even under identical weights.
`config/weights.json` contains `"DEL-BOM": 0.4331, "DEL-BLR": 0.3061, "BOM-BLR": 0.2608`
sourced from DGCA Monthly Statistics via the `Vonter/india-aviation-traffic` ODbL dataset.

- [ ] **Step 2: Insert the Methodology section**

Using the Edit tool, replace this exact text in `README.md` (the `## Why only one live
source right now` heading, now directly preceded by the file-map table from Task 1):

```markdown
| `docs/`     | Specs, plans, validation report                                   |

## Why only one live source right now
```

with this exact text:

```markdown
| `docs/`     | Specs, plans, validation report                                   |

## Methodology

SkyMetrics computes four index formulas over the same underlying fare data
(`index/formulas.py`), each a different way of aggregating route-level price relatives
(current price / base-period price) into a single number:

- **Simple relative** — the unweighted mean of every route's price relative. Treats all
  routes equally regardless of passenger volume.
- **Laspeyres** — the weighted *arithmetic* mean of price relatives, using base-period
  route weights (i.e. how much passenger traffic each route carried in the base period).
- **Paasche** — the weighted *harmonic* mean of price relatives, using current-period
  route weights.
- **Fisher** — the geometric mean of the Laspeyres and Paasche values above; the standard
  "ideal index" that splits the difference between the two.

Laspeyres and Paasche diverge even when given numerically identical weights — this isn't
a bug, it's a property of arithmetic vs. harmonic means (arithmetic mean >= harmonic
mean, with equality only when every price relative is identical). See the docstring in
`index/formulas.py` for the full explanation.

The real route weights currently in use (`config/weights.json`) come from DGCA Monthly
Statistics (Domestic Air Transport), via the
[Vonter/india-aviation-traffic](https://github.com/Vonter/india-aviation-traffic) dataset
(ODbL license), based on each route's share of 2025 full-year passenger traffic:

| Route   | Weight |
|---------|--------|
| DEL-BOM | 0.4331 |
| DEL-BLR | 0.3061 |
| BOM-BLR | 0.2608 |

For empirical proof these formulas track real-world airfare inflation, see
`docs/validation-report.md`, which back-tests the computed index against the Ministry of
Commerce's Service PPI (Air Passenger) reference series.

## Why only one live source right now
```

- [ ] **Step 3: Verify the section renders correctly**

Run:

```bash
sed -n '/^## Methodology$/,/^## Why only one live source/p' README.md
```

Expected: the bullet list, the divergence-explanation paragraph, the weights table, and
the closing pointer to `docs/validation-report.md` all print exactly as written above.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Methodology section to README"
```

### Task 3: Full-file consistency pass

**Files:**
- Read only: `README.md`

- [ ] **Step 1: Read the full README top to bottom**

Confirm: heading levels are consistent (`##` for top-level sections throughout, no `###`
introduced), the new sections sit between `## Status` and `## Why only one live source
right now` as designed, and no existing section (Setup, Running the scraper, Running the
API, Running the dashboard, Running with Docker, Testing, License) was altered.

- [ ] **Step 2: Confirm no other file changed**

```bash
git status --short
git diff HEAD~2 -- README.md
```

Expected: `git status --short` shows a clean tree (everything committed in Tasks 1-2),
and the diff touches only the two new sections — no line inside any pre-existing section
was modified.

No commit needed for this task — it's a read-only verification pass over the commits
already made in Tasks 1 and 2.
