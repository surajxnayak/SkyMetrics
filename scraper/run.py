"""CLI entrypoint: run every active scraper across the configured basket (PRD F-1.2)."""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper
from scraper.storage import write_quotes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("scraper.run")

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"

# Only sources with status "active" in config/sources.json are wired here.
# Adding a source later: add its module under scraper/sources/, add one line
# below, and flip its status in sources.json once live-verified.
SCRAPERS = {
    "akasaair": AkasaScraper,
}


def load_basket() -> dict:
    return json.loads((CONFIG_DIR / "basket.json").read_text(encoding="utf-8"))


def run() -> None:
    basket = load_basket()
    guard = ComplianceGuard()
    run_id = uuid.uuid4().hex

    for source_name, scraper_cls in SCRAPERS.items():
        scraper = scraper_cls(guard)
        quotes = []
        for pair in basket["city_pairs"]:
            try:
                quotes.extend(scraper.fetch_quotes(pair["origin"], pair["destination"], run_id))
            except PermissionError as exc:
                # ponytail: only robots.txt disallow is handled per-route here;
                # transient network errors abort the whole run loudly (visible
                # in CI/Actions logs) -- add retry/alerting if scheduled-run
                # reliability becomes an issue (PRD success metric, §10).
                logger.error(
                    "skipping %s-%s on %s: %s",
                    pair["origin"],
                    pair["destination"],
                    source_name,
                    exc,
                )
        out_path = write_quotes(quotes, source_name, run_id)
        logger.info("wrote %d quotes for %s to %s", len(quotes), source_name, out_path)


if __name__ == "__main__":
    run()
