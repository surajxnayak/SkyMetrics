# SkyMetrics Phase 5 Validation Report

## Methodology

The Airfare Price Index (APIx) is compared against an external government reference series using two statistics: Mean Absolute Percentage Error (MAPE) and Pearson correlation, both computed over matched quarter-over-quarter percentage growth rates (not raw index levels, since the two series have different base periods).

## Reference data

Source: Service Producer Price Index (Base Year 2022-23), Air (Passenger) Service Price Index -- Office of the Economic Adviser, Ministry of Commerce & Industry, Government of India

Source URL: https://eaindustry.nic.in/download_data_2223.asp

Retrieved: 2026-08-26

Methodology note: Quarterly, base year 2022-23=100. Index not compiled before Q1 FY2025-26 (source's own footnote: price reference period is FY2025-26). Q1 FY2026-27 is marked provisional by the source.

| Fiscal quarter | Period | Index value | Provisional |
|---|---|---|---|
| 2025-26 Q1 | 2025-04-01 to 2025-06-30 | 95.8 | No |
| 2025-26 Q2 | 2025-07-01 to 2025-09-30 | 94.3 | No |
| 2025-26 Q3 | 2025-10-01 to 2025-12-31 | 107.3 | No |
| 2025-26 Q4 | 2026-01-01 to 2026-03-31 | 106.9 | No |
| 2026-27 Q1 | 2026-04-01 to 2026-06-30 | 126.4 | Yes |

## Why this reference source

The SIH problem statement asks for back-testing against "publicly available DGCA monthly average-fare data." Research confirmed this doesn't exist in usable form: DGCA's only public fare data is sporadic Parliament written-answer disclosures (see the DGCA corroboration section below) -- no downloadable file, no route list, no absolute fares, no fixed publication schedule. The problem statement's own named "Dataset Link" (esankhyiki.mospi.gov.in) is MoSPI's general macroeconomic statistics portal (CPI, IIP, GDP), not a curated aviation/fare dataset. The Service PPI's Air (Passenger) Service Price Index above was chosen instead because it is real, official Government of India data (Ministry of Commerce & Industry), downloadable in a structured format, and has a dedicated air-passenger line rather than a bundled "Transport" catch-all -- the closest genuine, verifiable substitute for what the problem statement's DGCA reference was intended to provide.

## Our own APIx history

1 snapshot(s) currently committed:

- `3f7431f401454339b39bb5345734f840` (daily, written 2026-08-24T17:02:08.541821+00:00)

## Back-test result

Overlapping fiscal quarters: []

Growth-rate pairs used: 0

MAPE: None

Pearson correlation: None

Only 0 overlapping quarter(s) between our APIx history and the reference data (need 3+ overlapping quarters to compute a growth-rate correlation). This reflects the project's real, current data maturity, not an error.

## DGCA corroboration (qualitative)

DGCA has separately disclosed, via a written Parliament reply (Minister of State for Civil Aviation, Rajya Sabha), an approximate 20.5% average airfare increase across 72 undisclosed domestic routes, June 2026 vs March 2025, as reported by media (https://www.millenniumpost.in/business/avg-airfare-on-72-domestic-routes-rose-205-in-june-dgca-data-669983 -- the primary Parliament document itself was not found with a direct public URL during research). This figure is cited here as qualitative, directional corroboration only -- it has no downloadable route list, no absolute fares, and its comparison window ends before this project's own APIx history begins (2026-08-24), so it cannot be run through the quantitative back-test above.
