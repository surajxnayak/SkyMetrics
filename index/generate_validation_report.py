"""Renders the Phase 5 back-test validation report (PRD §9): methodology,
the real reference dataset, our own APIx history summary, the back-test
result (honest about today's real data-maturity limits), and DGCA's
qualitative fare-change disclosures as non-quantitative corroboration.
"""
from __future__ import annotations

from index.backtest import load_reference_series, run_backtest
from index.build import build_series, load_all_cleaned_records
from index.weights import load_weights

DGCA_CORROBORATION_NOTE = (
    "DGCA has separately disclosed, via a written Parliament reply (Minister of "
    "State for Civil Aviation, Rajya Sabha), an approximate 20.5% average airfare "
    "increase across 72 undisclosed domestic routes, June 2026 vs March 2025, as "
    "reported by media "
    "(https://www.millenniumpost.in/business/avg-airfare-on-72-domestic-routes-rose-205-in-june-dgca-data-669983"  # noqa: E501
    " -- the primary Parliament document itself was not found with a direct public "
    "URL during research). This figure is cited here as qualitative, directional "
    "corroboration only -- it has no downloadable route list, no absolute fares, "
    "and its comparison window ends before this project's own APIx history begins "
    "(2026-08-24), so it cannot be run through the quantitative back-test above."
)


def generate_report(apix_snapshots: list[dict], reference_data: dict, backtest_result: dict) -> str:
    lines = [
        "# SkyMetrics Phase 5 Validation Report",
        "",
        "## Methodology",
        "",
        "The Airfare Price Index (APIx) is compared against an external government "
        "reference series using two statistics: Mean Absolute Percentage Error "
        "(MAPE) and Pearson correlation, both computed over matched "
        "quarter-over-quarter percentage growth rates (not raw index levels, since "
        "the two series have different base periods).",
        "",
        "## Reference data",
        "",
        f"Source: {reference_data['source']}",
        "",
        f"Source URL: {reference_data['source_url']}",
        "",
        f"Retrieved: {reference_data['retrieved_at']}",
        "",
        f"Methodology note: {reference_data['methodology_note']}",
        "",
        "| Fiscal quarter | Period | Index value | Provisional |",
        "|---|---|---|---|",
    ]
    for q in reference_data["quarters"]:
        lines.append(
            f"| {q['fiscal_year']} {q['quarter']} | {q['period_start']} to {q['period_end']} "
            f"| {q['index_value']} | {'Yes' if q['provisional'] else 'No'} |"
        )

    lines += [
        "",
        "## Why this reference source",
        "",
        "The SIH problem statement asks for back-testing against \"publicly available DGCA "
        "monthly average-fare data.\" Research confirmed this doesn't exist in usable form: "
        "DGCA's only public fare data is sporadic Parliament written-answer disclosures (see "
        "the DGCA corroboration section below) -- no downloadable file, no route list, no "
        "absolute fares, no fixed publication schedule. The problem statement's own named "
        "\"Dataset Link\" (esankhyiki.mospi.gov.in) is MoSPI's general macroeconomic statistics "
        "portal (CPI, IIP, GDP), not a curated aviation/fare dataset. The Service PPI's Air "
        "(Passenger) Service Price Index above was chosen instead because it is real, official "
        "Government of India data (Ministry of Commerce & Industry), downloadable in a "
        "structured format, and has a dedicated air-passenger line rather than a bundled "
        "\"Transport\" catch-all -- the closest genuine, verifiable substitute for what the "
        "problem statement's DGCA reference was intended to provide.",
    ]

    lines += [
        "",
        "## Our own APIx history",
        "",
        f"{len(apix_snapshots)} snapshot(s) currently committed:",
        "",
    ]
    for snapshot in apix_snapshots:
        lines.append(
            f"- `{snapshot['comparison_id']}` "
            f"({snapshot['frequency']}, written {snapshot['written_at']})"
        )
    if not apix_snapshots:
        lines.append("- (none yet)")

    lines += [
        "",
        "## Back-test result",
        "",
        f"Overlapping fiscal quarters: {backtest_result['overlapping_quarters']}",
        "",
        f"Growth-rate pairs used: {backtest_result['n_growth_pairs']}",
        "",
        f"MAPE: {backtest_result['mape']}",
        "",
        f"Pearson correlation: {backtest_result['pearson_correlation']}",
        "",
        backtest_result["note"],
        "",
        "## DGCA corroboration (qualitative)",
        "",
        DGCA_CORROBORATION_NOTE,
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    from pathlib import Path

    from api.data_access import list_snapshots

    records = load_all_cleaned_records()
    monthly_series = build_series(records, "monthly", load_weights())
    reference = load_reference_series()
    result = run_backtest(monthly_series, reference)
    report = generate_report(
        apix_snapshots=list_snapshots(),
        reference_data=reference,
        backtest_result=result,
    )
    Path("docs/validation-report.md").write_text(report, encoding="utf-8")
    print("wrote docs/validation-report.md")
