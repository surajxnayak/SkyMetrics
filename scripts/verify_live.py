"""Manual live check against the real Akasa Air endpoint. Not part of the
automated test suite (CI must never depend on live network access) -- run
this by hand after any change to scraper/sources/akasa.py or scraper/compliance.py.

Run from anywhere as: python scripts/verify_live.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scraper.compliance import ComplianceGuard  # noqa: E402
from scraper.sources.akasa import AkasaScraper  # noqa: E402

if __name__ == "__main__":
    guard = ComplianceGuard()
    scraper = AkasaScraper(guard)
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="verify-live")
    for q in quotes:
        print(
            q.advance_window,
            q.travel_date,
            q.status,
            q.fare_class,
            "total=", q.total_fare,
            "base=", q.base_fare,
            "tax=", q.taxes,
            "udf=", q.udf,
            "conv=", q.convenience_fee,
        )
