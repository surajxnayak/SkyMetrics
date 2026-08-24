"""Manual live check against the real Akasa Air endpoint. Not part of the
automated test suite (CI must never depend on live network access) -- run
this by hand after any change to scraper/sources/akasa.py or scraper/compliance.py.
"""
from scraper.compliance import ComplianceGuard
from scraper.sources.akasa import AkasaScraper

if __name__ == "__main__":
    guard = ComplianceGuard()
    scraper = AkasaScraper(guard)
    quotes = scraper.fetch_quotes("DEL", "BOM", run_id="verify-live")
    for q in quotes:
        print(q.advance_window, q.travel_date, q.status, q.total_fare)
