# README Documentation (Phase 5 docs) — Design

## Purpose

Phase 5 of the PRD roadmap is "Validation report, documentation, automated tests." The
validation report (`docs/validation-report.md`) and automated tests are already done across
every phase. This is the last remaining piece: documentation.

`README.md` already covers setup/run instructions well (Setup, Running the scraper,
Cleaning and index construction, Running the API, Running the dashboard, Running with
Docker, Testing). What's missing is the substance a Smart India Hackathon judge needs to
evaluate the project without reading source code: how the pieces fit together, and what
the index numbers actually mean and how they're computed.

## Scope

Expand `README.md` in place with two new sections. No new files, no changes to any other
existing section, no code changes.

## Placement

Insert both new sections after `## Status` and before `## Why only one live source right
now`, so the read order is: what's done → how it's built → why only one data source →
how to run it.

## Section: `## Architecture`

Content:
- A short ASCII pipeline diagram showing the data flow:
  `scraper -> clean -> index -> API -> dashboard`, with PostgreSQL as the shared store
  those last three stages read/write.
- One sentence per stage naming its real entry-point module:
  - `scraper/run.py` — Akasa Air scraper, robots.txt/rate-limit compliant (`scraper/compliance.py`)
  - `pipeline/clean.py` — de-duplication + IQR outlier flagging
  - `index/build.py` — computes and writes versioned APIx snapshots to Postgres
  - `api/main.py` — FastAPI REST layer serving the index, cleaned fares, and methodology metadata
  - `dashboard/` — React + TypeScript dashboard consuming the API
- A compact file-map table of top-level directories and their responsibility
  (`scraper/`, `pipeline/`, `index/`, `api/`, `dashboard/`, `db/`, `config/`, `docs/`).

Sourcing: module names and responsibilities are verified against the actual files listed
above, not invented.

## Section: `## Methodology`

Content, in plain English, covering the four formulas actually implemented in
`index/formulas.py`:
- **Simple relative** — unweighted mean of current/base price ratios.
- **Laspeyres** — weighted *arithmetic* mean of price relatives, using base-period route
  weights.
- **Paasche** — weighted *harmonic* mean of price relatives, using current-period route
  weights.
- **Fisher** — geometric mean of Laspeyres and Paasche.
- A note (sourced from `index/formulas.py`'s existing docstring) that Laspeyres and
  Paasche are different kinds of mean over the same price relatives, so they diverge even
  when given numerically identical weights — not a bug, a property of the two formulas.

Concrete example: cite the real DGCA-derived route weights from `config/weights.json`
(DEL-BOM 0.4331, DEL-BLR 0.3061, BOM-BLR 0.2608, sourced from DGCA Monthly Statistics via
the `Vonter/india-aviation-traffic` ODbL dataset).

Closes with a pointer to `docs/validation-report.md` as the empirical proof these index
numbers track a real government reference series (Ministry of Commerce's Service PPI).

## Non-goals

- No new documentation files (judge-facing submission doc, architecture doc, etc.) — out
  of scope per this round's decision to expand README only.
- No changes to existing README sections (Setup, Running the scraper, etc.).
- No diagramming tooling (Mermaid, image exports) — plain ASCII only, so it renders
  correctly in any plaintext viewer a judge might use, not just GitHub's renderer.

## Verification

This is a pure documentation change — no code, so no automated tests apply. Verification
is a fact-check pass: every module name, file path, formula description, and numeric
value cited in the new sections is checked against the actual current source
(`index/formulas.py`, `config/weights.json`, the real directory listing) rather than
trusted from memory. This replaces the spec-compliance review step for this task.
