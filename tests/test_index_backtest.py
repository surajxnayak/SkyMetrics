import pytest

from index.backtest import mape, pearson_correlation


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
