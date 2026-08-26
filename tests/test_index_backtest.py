import json

import pytest

from index.backtest import fiscal_quarter_of, load_reference_series, mape, pearson_correlation


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
