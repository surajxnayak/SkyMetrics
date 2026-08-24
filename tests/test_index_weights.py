import json

from index.weights import load_weights, route_key


def test_load_weights_reads_a_given_file(tmp_path):
    weights_file = tmp_path / "weights.json"
    weights_file.write_text(
        json.dumps({"source": "test", "weights": {"DEL-BOM": 0.5, "DEL-BLR": 0.5}})
    )

    weights = load_weights(weights_path=weights_file)

    assert weights == {"DEL-BOM": 0.5, "DEL-BLR": 0.5}


def test_route_key_formats_origin_destination():
    assert route_key("DEL", "BOM") == "DEL-BOM"


def test_real_weights_file_has_all_three_basket_routes():
    weights = load_weights()
    assert set(weights.keys()) == {"DEL-BOM", "DEL-BLR", "BOM-BLR"}
    assert abs(sum(weights.values()) - 1.0) < 1e-6
