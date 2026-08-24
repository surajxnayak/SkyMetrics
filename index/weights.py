"""Route weights for index construction, sourced from real DGCA data (PRD F-3.1).

See config/weights.json for source attribution. Weights are a static,
committed snapshot -- DGCA's own publication cadence is monthly/annual, not
something to re-fetch per index run. Refresh config/weights.json by hand
when a newer DGCA annual release is available.
"""
from __future__ import annotations

import json
from pathlib import Path

WEIGHTS_PATH = Path("config/weights.json")


def load_weights(weights_path: Path = WEIGHTS_PATH) -> dict[str, float]:
    payload = json.loads(weights_path.read_text(encoding="utf-8"))
    return payload["weights"]


def route_key(origin: str, destination: str) -> str:
    return f"{origin}-{destination}"
