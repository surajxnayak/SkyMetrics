import math

import pytest

from index.formulas import fisher, laspeyres, paasche, simple_relative

BASE = {"DEL-BOM": 6000.0, "DEL-BLR": 7000.0, "BOM-BLR": 5000.0}
CURRENT = {"DEL-BOM": 6600.0, "DEL-BLR": 7000.0, "BOM-BLR": 5500.0}
WEIGHTS = {"DEL-BOM": 0.4331, "DEL-BLR": 0.3061, "BOM-BLR": 0.2608}


def test_simple_relative_is_unweighted_average_of_relatives():
    # relatives: 1.10, 1.00, 1.10 -> mean 1.06667 -> *100
    assert simple_relative(BASE, CURRENT) == pytest.approx(106.66666666666667)


def test_laspeyres_uses_base_weights():
    # hand-computed: 0.4331*1.1 + 0.3061*1.0 + 0.2608*1.1, weights already sum to 1.0
    assert laspeyres(BASE, CURRENT, WEIGHTS) == pytest.approx(106.939)


def test_paasche_uses_current_weights():
    assert paasche(BASE, CURRENT, WEIGHTS) == pytest.approx(106.939)


def test_laspeyres_and_paasche_coincide_with_the_same_static_weights():
    # Documents the design spec's known limitation directly: with only one
    # weight source, current-period weights equal base-period weights.
    assert laspeyres(BASE, CURRENT, WEIGHTS) == paasche(BASE, CURRENT, WEIGHTS)


def test_fisher_is_geometric_mean_of_laspeyres_and_paasche():
    las = laspeyres(BASE, CURRENT, WEIGHTS)
    paa = paasche(BASE, CURRENT, WEIGHTS)
    assert fisher(las, paa) == pytest.approx(math.sqrt(las * paa))


def test_index_equals_100_when_prices_unchanged():
    assert simple_relative(BASE, BASE) == pytest.approx(100.0)
    assert laspeyres(BASE, BASE, WEIGHTS) == pytest.approx(100.0)
