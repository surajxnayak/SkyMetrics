import json

import pytest

from index.backtest import (
    aggregate_apix_to_quarters,
    align_growth_rates,
    fiscal_quarter_of,
    load_reference_series,
    mape,
    pearson_correlation,
    run_backtest,
)


def test_mape_zero_when_series_match_exactly():
    assert mape([100.0, 105.0, 110.0], [100.0, 105.0, 110.0]) == 0.0


def test_mape_computes_average_percent_error():
    # errors: |100-110|/100=0.10, |100-90|/100=0.10 -> mean 0.10 -> 10%
    assert mape([100.0, 100.0], [110.0, 90.0]) == pytest.approx(10.0)


def test_mape_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        mape([100.0], [100.0, 105.0])


def test_mape_rejects_empty_series():
    with pytest.raises(ValueError):
        mape([], [])


def test_pearson_correlation_is_one_for_perfectly_linear_series():
    assert pearson_correlation([1.0, 2.0, 3.0, 4.0], [10.0, 20.0, 30.0, 40.0]) == pytest.approx(1.0)


def test_pearson_correlation_is_negative_one_for_inverse_series():
    result = pearson_correlation([1.0, 2.0, 3.0, 4.0], [40.0, 30.0, 20.0, 10.0])
    assert result == pytest.approx(-1.0)


def test_pearson_correlation_rejects_fewer_than_two_points():
    with pytest.raises(ValueError):
        pearson_correlation([1.0], [1.0])


def test_pearson_correlation_rejects_zero_variance_series():
    with pytest.raises(ValueError):
        pearson_correlation([5.0, 5.0, 5.0], [1.0, 2.0, 3.0])


def test_load_reference_series_reads_a_given_file(tmp_path):
    ref_file = tmp_path / "reference.json"
    ref_file.write_text(
        json.dumps(
            {
                "source": "test",
                "source_url": "https://example.com",
                "retrieved_at": "2026-01-01",
                "methodology_note": "test",
                "quarters": [
                    {
                        "fiscal_year": "2025-26",
                        "quarter": "Q1",
                        "period_start": "2025-04-01",
                        "period_end": "2025-06-30",
                        "index_value": 100.0,
                        "provisional": False,
                    }
                ],
            }
        )
    )

    reference = load_reference_series(path=ref_file)

    assert reference["source"] == "test"
    assert reference["quarters"][0]["index_value"] == 100.0


def test_real_reference_file_has_five_real_quarters():
    reference = load_reference_series()

    assert len(reference["quarters"]) == 5
    values = {(q["fiscal_year"], q["quarter"]): q["index_value"] for q in reference["quarters"]}
    assert values[("2025-26", "Q1")] == 95.8
    assert values[("2026-27", "Q1")] == 126.4


def test_fiscal_quarter_of_maps_calendar_months_to_fiscal_quarters():
    assert fiscal_quarter_of("2026-04") == ("2026-27", "Q1")
    assert fiscal_quarter_of("2026-06") == ("2026-27", "Q1")
    assert fiscal_quarter_of("2026-07") == ("2026-27", "Q2")
    assert fiscal_quarter_of("2026-09") == ("2026-27", "Q2")
    assert fiscal_quarter_of("2026-10") == ("2026-27", "Q3")
    assert fiscal_quarter_of("2026-12") == ("2026-27", "Q3")
    assert fiscal_quarter_of("2026-08") == ("2026-27", "Q2")


def test_fiscal_quarter_of_handles_january_march_as_prior_fiscal_year_q4():
    assert fiscal_quarter_of("2026-01") == ("2025-26", "Q4")
    assert fiscal_quarter_of("2026-02") == ("2025-26", "Q4")
    assert fiscal_quarter_of("2026-03") == ("2025-26", "Q4")


def test_fiscal_quarter_of_rejects_malformed_period():
    with pytest.raises(ValueError):
        fiscal_quarter_of("not-a-period")


def test_aggregate_apix_to_quarters_buckets_and_averages_simple_relative():
    apix_series = [
        {"period": "2026-04", "simple_relative": 100.0},
        {"period": "2026-05", "simple_relative": 110.0},
        {"period": "2026-06", "simple_relative": 120.0},
        {"period": "2026-07", "simple_relative": 200.0},
    ]

    result = aggregate_apix_to_quarters(apix_series)

    assert result[("2026-27", "Q1")] == pytest.approx(110.0)  # mean(100, 110, 120)
    assert result[("2026-27", "Q2")] == pytest.approx(200.0)


def test_aggregate_apix_to_quarters_handles_empty_series():
    assert aggregate_apix_to_quarters([]) == {}


def test_align_growth_rates_computes_matched_period_over_period_growth():
    apix_quarters = {
        ("2025-26", "Q1"): 100.0,
        ("2025-26", "Q2"): 110.0,
        ("2025-26", "Q3"): 121.0,
        ("2025-26", "Q4"): 133.1,
    }
    reference_quarters = {
        ("2025-26", "Q1"): 200.0,
        ("2025-26", "Q2"): 220.0,
        ("2025-26", "Q3"): 242.0,
        ("2025-26", "Q4"): 266.2,
    }

    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    assert apix_growth == pytest.approx([10.0, 10.0, 10.0])
    assert reference_growth == pytest.approx([10.0, 10.0, 10.0])


def test_align_growth_rates_only_uses_quarters_present_in_both():
    apix_quarters = {("2025-26", "Q1"): 100.0, ("2025-26", "Q2"): 110.0, ("2026-27", "Q1"): 999.0}
    reference_quarters = {("2025-26", "Q1"): 200.0, ("2025-26", "Q2"): 220.0}

    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    # Only ("2025-26", "Q1") and ("2025-26", "Q2") overlap -> exactly 1 growth-rate point.
    assert apix_growth == pytest.approx([10.0])
    assert reference_growth == pytest.approx([10.0])


def test_align_growth_rates_returns_empty_lists_when_fewer_than_two_overlapping_quarters():
    apix_quarters = {("2026-27", "Q2"): 100.0}
    reference_quarters = {
        ("2025-26", "Q1"): 95.8,
        ("2025-26", "Q2"): 94.3,
        ("2025-26", "Q3"): 107.3,
        ("2025-26", "Q4"): 106.9,
        ("2026-27", "Q1"): 126.4,
    }

    apix_growth, reference_growth = align_growth_rates(apix_quarters, reference_quarters)

    assert apix_growth == []
    assert reference_growth == []


def test_run_backtest_computes_real_statistics_when_enough_quarters_overlap():
    # Growth rates deliberately vary quarter to quarter (not constant, no
    # zero values) so this exercises real, non-degenerate mape()/
    # pearson_correlation() computation. The exact statistical values are
    # already covered by mape()'s and pearson_correlation()'s own dedicated
    # tests -- this test's job is to verify run_backtest() wires aggregation
    # + alignment + those functions together correctly, not to re-verify
    # their math.
    apix_series = [
        {"period": "2025-04", "simple_relative": 100.0},
        {"period": "2025-07", "simple_relative": 120.0},
        {"period": "2025-10", "simple_relative": 114.0},
        {"period": "2026-01", "simple_relative": 125.4},
    ]
    reference_data = {
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "index_value": 200.0},
            {"fiscal_year": "2025-26", "quarter": "Q2", "index_value": 210.0},
            {"fiscal_year": "2025-26", "quarter": "Q3", "index_value": 220.5},
            {"fiscal_year": "2025-26", "quarter": "Q4", "index_value": 209.475},
        ]
    }

    result = run_backtest(apix_series, reference_data)

    assert result["n_growth_pairs"] == 3
    assert result["overlapping_quarters"] == [
        ("2025-26", "Q1"),
        ("2025-26", "Q2"),
        ("2025-26", "Q3"),
        ("2025-26", "Q4"),
    ]
    assert isinstance(result["mape"], float)
    assert result["mape"] >= 0.0
    assert isinstance(result["pearson_correlation"], float)
    assert -1.0 <= result["pearson_correlation"] <= 1.0


def test_run_backtest_handles_degenerate_growth_data_without_crashing():
    # Both series grow by a perfectly constant 10% every quarter -- zero
    # variance in the growth-rate series, which makes pearson_correlation()
    # raise ValueError by design (Phase 3 behavior, unchanged). run_backtest
    # must catch this and report it honestly rather than crash: a flat
    # growth-rate quarter is a realistic outcome for real future data, not
    # just a hypothetical edge case.
    apix_series = [
        {"period": "2025-04", "simple_relative": 100.0},
        {"period": "2025-07", "simple_relative": 110.0},
        {"period": "2025-10", "simple_relative": 121.0},
        {"period": "2026-01", "simple_relative": 133.1},
    ]
    reference_data = {
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "index_value": 200.0},
            {"fiscal_year": "2025-26", "quarter": "Q2", "index_value": 220.0},
            {"fiscal_year": "2025-26", "quarter": "Q3", "index_value": 242.0},
            {"fiscal_year": "2025-26", "quarter": "Q4", "index_value": 266.2},
        ]
    }

    result = run_backtest(apix_series, reference_data)

    assert result["n_growth_pairs"] == 3
    assert result["mape"] is None
    assert result["pearson_correlation"] is None
    assert result["note"] != ""


def test_run_backtest_reports_insufficient_data_honestly_for_todays_real_state():
    # This is the actual current real-world case: our only real monthly APIx
    # period (August 2026, fiscal Q2 FY2026-27) doesn't overlap the real
    # committed reference data (which only goes through Q1 FY2026-27, ending
    # June 2026).
    apix_series = [{"period": "2026-08", "simple_relative": 100.0}]
    reference_data = load_reference_series()

    result = run_backtest(apix_series, reference_data)

    assert result["n_growth_pairs"] == 0
    assert result["mape"] is None
    assert result["pearson_correlation"] is None
    assert result["note"] != ""


def test_run_backtest_reports_insufficient_data_at_exactly_two_overlapping_quarters():
    apix_series = [
        {"period": "2025-04", "simple_relative": 100.0},
        {"period": "2025-07", "simple_relative": 110.0},
    ]
    reference_data = {
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "index_value": 200.0},
            {"fiscal_year": "2025-26", "quarter": "Q2", "index_value": 220.0},
        ]
    }

    result = run_backtest(apix_series, reference_data)

    assert result["overlapping_quarters"] == [("2025-26", "Q1"), ("2025-26", "Q2")]
    assert result["n_growth_pairs"] == 1
    assert result["mape"] is None
    assert result["pearson_correlation"] is None


def test_run_backtest_computes_statistics_at_exactly_three_overlapping_quarters():
    # Reference index deliberately does NOT reuse 220.5 for Q3: that value
    # (taken from the 4-quarter "enough data" test) makes Q1->Q2->Q3
    # reference growth exactly [5.0, 5.0] -- constant, zero variance -- which
    # would trip pearson_correlation()'s (correct) zero-variance guard and
    # make this "success branch" test degenerate by accident, the same trap
    # flagged in this module's history. 200.0 keeps both growth series
    # genuinely non-constant so this exercises the real success path.
    apix_series = [
        {"period": "2025-04", "simple_relative": 100.0},
        {"period": "2025-07", "simple_relative": 120.0},
        {"period": "2025-10", "simple_relative": 114.0},
    ]
    reference_data = {
        "quarters": [
            {"fiscal_year": "2025-26", "quarter": "Q1", "index_value": 200.0},
            {"fiscal_year": "2025-26", "quarter": "Q2", "index_value": 210.0},
            {"fiscal_year": "2025-26", "quarter": "Q3", "index_value": 200.0},
        ]
    }

    result = run_backtest(apix_series, reference_data)

    assert result["overlapping_quarters"] == [
        ("2025-26", "Q1"),
        ("2025-26", "Q2"),
        ("2025-26", "Q3"),
    ]
    assert result["n_growth_pairs"] == 2
    assert isinstance(result["mape"], float)
    assert isinstance(result["pearson_correlation"], float)
