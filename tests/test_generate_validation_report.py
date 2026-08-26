from index.generate_validation_report import generate_report


def _reference_data():
    return {
        "source": (
            "Service Producer Price Index (Base Year 2022-23), Air (Passenger) Service "
            "Price Index -- Office of the Economic Adviser, Ministry of Commerce & "
            "Industry, Government of India"
        ),
        "source_url": "https://eaindustry.nic.in/download_data_2223.asp",
        "retrieved_at": "2026-08-26",
        "methodology_note": "Quarterly, base year 2022-23=100.",
        "quarters": [
            {
                "fiscal_year": "2025-26",
                "quarter": "Q1",
                "period_start": "2025-04-01",
                "period_end": "2025-06-30",
                "index_value": 95.8,
                "provisional": False,
            },
            {
                "fiscal_year": "2026-27",
                "quarter": "Q1",
                "period_start": "2026-04-01",
                "period_end": "2026-06-30",
                "index_value": 126.4,
                "provisional": True,
            },
        ],
    }


def test_generate_report_includes_methodology_and_reference_table():
    report = generate_report(
        apix_snapshots=[],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [],
            "n_growth_pairs": 0,
            "mape": None,
            "pearson_correlation": None,
            "note": "insufficient data",
        },
    )

    assert "mape" in report.lower()
    assert "pearson" in report.lower()
    assert "95.8" in report
    assert "126.4" in report
    assert "eaindustry.nic.in" in report
    assert "| No |" in report
    assert "| Yes |" in report
    assert "esankhyiki" in report
    assert "Why this reference source" in report


def test_generate_report_renders_insufficient_data_result_honestly():
    report = generate_report(
        apix_snapshots=[],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [],
            "n_growth_pairs": 0,
            "mape": None,
            "pearson_correlation": None,
            "note": "insufficient data explanation here",
        },
    )

    assert "insufficient data explanation here" in report


def test_generate_report_renders_a_populated_result():
    report = generate_report(
        apix_snapshots=[
            {
                "comparison_id": "abc123",
                "frequency": "monthly",
                "written_at": "2026-08-26T00:00:00+00:00",
            }
        ],
        reference_data=_reference_data(),
        backtest_result={
            "overlapping_quarters": [("2025-26", "Q1"), ("2025-26", "Q2")],
            "n_growth_pairs": 1,
            "mape": 5.0,
            "pearson_correlation": 0.9,
            "note": "Computed over 1 matched quarter-over-quarter growth-rate pairs.",
        },
    )

    assert "5.0" in report
    assert "0.9" in report
    assert "abc123" in report
