import json
import os
from datetime import date, datetime, timezone

import pytest

from pipeline.clean import clean_run, clean_run_to_db, load_run_quotes
from scraper.schema import FareQuote, new_quote_id
from scraper.storage import write_quotes


def _quote(**overrides):
    defaults = dict(
        quote_id=new_quote_id(),
        origin="DEL",
        destination="BOM",
        carrier="QP",
        source="akasaair",
        travel_date=date(2026, 9, 1),
        collected_at=datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc),
        advance_window="T+7",
        fare_class="T0",
        base_fare=5985.0,
        taxes=306.0,
        udf=152.0,
        convenience_fee=800.0,
        total_fare=7243.0,
        status="available",
        run_id="run-1",
        fee_breakdown=None,
        routing=None,
    )
    defaults.update(overrides)
    return FareQuote(**defaults)


def test_load_run_quotes_reads_across_source_directories(tmp_path):
    write_quotes([_quote(source="akasaair")], source="akasaair", run_id="run-1", base_dir=tmp_path)
    write_quotes([_quote(source="otherair")], source="otherair", run_id="run-1", base_dir=tmp_path)

    quotes = load_run_quotes("run-1", raw_base_dir=tmp_path)

    assert len(quotes) == 2
    assert {q.source for q in quotes} == {"akasaair", "otherair"}


def test_load_run_quotes_ignores_other_run_ids(tmp_path):
    write_quotes([_quote()], source="akasaair", run_id="run-1", base_dir=tmp_path)
    write_quotes([_quote()], source="akasaair", run_id="run-2", base_dir=tmp_path)

    quotes = load_run_quotes("run-1", raw_base_dir=tmp_path)

    assert len(quotes) == 1


def test_load_run_quotes_returns_empty_list_for_missing_raw_dir(tmp_path):
    quotes = load_run_quotes("run-1", raw_base_dir=tmp_path / "does-not-exist")
    assert quotes == []


def test_clean_run_writes_empty_file_when_no_raw_data_exists(tmp_path):
    raw_dir = tmp_path / "raw"
    cleaned_dir = tmp_path / "cleaned"

    out_path = clean_run("run-1", raw_base_dir=raw_dir, cleaned_base_dir=cleaned_dir)

    assert out_path == cleaned_dir / "run-1.jsonl"
    assert out_path.read_text(encoding="utf-8") == ""


def test_clean_run_writes_deduped_flagged_output(tmp_path):
    raw_dir = tmp_path / "raw"
    cleaned_dir = tmp_path / "cleaned"
    duplicate_a = _quote(total_fare=7000.0)
    duplicate_b = _quote(total_fare=7000.0)
    write_quotes([duplicate_a, duplicate_b], source="akasaair", run_id="run-1", base_dir=raw_dir)

    out_path = clean_run("run-1", raw_base_dir=raw_dir, cleaned_base_dir=cleaned_dir)

    assert out_path == cleaned_dir / "run-1.jsonl"
    lines = out_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["is_outlier"] is False
    expected_ids = sorted([duplicate_a.quote_id, duplicate_b.quote_id])
    assert sorted(record["source_quote_ids"]) == expected_ids


def test_clean_run_to_db_inserts_cleaned_records(tmp_path):
    if "DATABASE_URL" not in os.environ:
        pytest.skip("DATABASE_URL not set in this environment")

    from api.db import get_connection

    raw_dir = tmp_path / "raw"
    quote = _quote(run_id="run-db-test-clean")
    write_quotes([quote], source="akasaair", run_id="run-db-test-clean", base_dir=raw_dir)

    conn = get_connection()
    try:
        count = clean_run_to_db("run-db-test-clean", conn=conn, raw_base_dir=raw_dir)
        assert count == 1
        with conn.cursor() as cur:
            cur.execute(
                "SELECT quote_id FROM fare_quotes WHERE run_id = %s", ("run-db-test-clean",)
            )
            assert cur.fetchone()[0] == quote.quote_id
    finally:
        # clean_run_to_db commits internally (it's the real production write
        # path), so conn.rollback() alone can't undo it -- explicit cleanup
        # is required to avoid leaving test data in the real database.
        with conn.cursor() as cur:
            cur.execute("DELETE FROM fare_quotes WHERE run_id = %s", ("run-db-test-clean",))
        conn.commit()
        conn.close()
