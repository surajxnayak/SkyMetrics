import os
from unittest.mock import MagicMock

import pytest

from api.ask import FALLBACK_MESSAGE, _tool_get_fare_records, _tool_get_index, answer_question

pytestmark = pytest.mark.skipif(
    "DATABASE_URL" not in os.environ, reason="DATABASE_URL not set in this environment"
)


def _function_call_response(name, args):
    response = MagicMock()
    part = MagicMock()
    part.function_call = MagicMock(name=name, args=args)
    part.function_call.name = name
    part.function_call.args = args
    response.candidates = [MagicMock(content=MagicMock(parts=[part]))]
    return response


def _text_response(text):
    response = MagicMock()
    part = MagicMock()
    part.function_call = None
    part.text = text
    response.candidates = [MagicMock(content=MagicMock(parts=[part]))]
    return response


def test_grounding_gate_rejects_a_first_response_that_is_not_a_tool_call():
    # This is the single most important test in this file: it proves the
    # enforcement is a real code gate, not a prompt instruction the model
    # could ignore.
    client = MagicMock()
    client.models.generate_content.return_value = _text_response(
        "Fares on DEL-BOM average Rs 8000."
    )

    result = answer_question("What's the fare on DEL-BOM?", [], conn=MagicMock(), client=client)

    assert result["answer"] == FALLBACK_MESSAGE
    assert result["tool_calls"] == []


def test_answers_using_the_real_tool_result_after_one_tool_call():
    client = MagicMock()
    client.models.generate_content.side_effect = [
        _function_call_response("get_metadata", {}),
        _text_response("The index uses 3 routes: DEL-BOM, DEL-BLR, BOM-BLR."),
    ]

    result = answer_question("What routes are in the index?", [], conn=MagicMock(), client=client)

    assert result["answer"] == "The index uses 3 routes: DEL-BOM, DEL-BLR, BOM-BLR."
    assert len(result["tool_calls"]) == 1
    assert result["tool_calls"][0]["name"] == "get_metadata"


def test_supports_multiple_tool_calls_in_one_turn():
    client = MagicMock()
    client.models.generate_content.side_effect = [
        _function_call_response("get_index", {"frequency": "daily"}),
        _function_call_response("get_metadata", {}),
        _text_response("Here's the index and how it's computed."),
    ]

    result = answer_question("Explain the current index", [], conn=MagicMock(), client=client)

    assert result["answer"] == "Here's the index and how it's computed."
    assert [call["name"] for call in result["tool_calls"]] == ["get_index", "get_metadata"]


def test_gives_up_after_max_tool_rounds_without_a_final_answer():
    client = MagicMock()
    client.models.generate_content.side_effect = [
        _function_call_response("get_metadata", {}),
        _function_call_response("get_metadata", {}),
        _function_call_response("get_metadata", {}),
    ]

    result = answer_question("loop forever", [], conn=MagicMock(), client=client)

    assert result["answer"] == FALLBACK_MESSAGE
    assert len(result["tool_calls"]) == 3


def test_tool_get_index_rejects_an_invalid_frequency():
    result = _tool_get_index({"frequency": "yearly"}, conn=MagicMock())

    assert "error" in result
    assert "yearly" in result["error"]


def test_tool_get_fare_records_rejects_an_invalid_route():
    result = _tool_get_fare_records({"route": ["XXX-YYY"]}, conn=MagicMock())

    assert "error" in result
    assert "XXX-YYY" in result["error"]


def test_tool_get_index_returns_real_snapshot_data(conn=None):
    from api.db import get_connection

    real_conn = get_connection()
    try:
        result = _tool_get_index({"frequency": "daily"}, real_conn)
        assert "error" not in result
        assert "series" in result
    finally:
        real_conn.rollback()
        real_conn.close()
