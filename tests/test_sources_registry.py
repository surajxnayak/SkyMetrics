import json
from pathlib import Path

from scraper.run import SCRAPERS

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "sources.json"


def test_every_wired_scraper_has_an_active_registry_entry():
    registry = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    active_names = {s["name"] for s in registry["sources"] if s["status"] == "active"}
    assert set(SCRAPERS.keys()) <= active_names
