"""Natural-language query interface over SkyMetrics' real data (Ask APIx).

Gemini Flash is given exactly 3 tools, each a thin wrapper around a real
api/data_access.py function -- it can retrieve real data, it cannot invent
any. The grounding gate in answer_question() is the actual enforcement:
if Gemini's first response in a turn is not a tool call, that response is
discarded and a fixed fallback is returned instead -- an ungrounded answer
never reaches the caller, regardless of what the model tried to say.
"""
from __future__ import annotations

import os

from google import genai
from google.genai import types

from api.data_access import (
    SnapshotNotFoundError,
    list_snapshots,
    load_fare_record_table,
    load_snapshot,
    load_weights_metadata,
)

# gemini-2.0-flash was retired mid-project and broke this endpoint. Tried the
# "-latest" alias first, but it was consistently overloaded (503s / 30-50s
# hangs) -- pinning to a specific current model was faster and more reliable.
GEMINI_MODEL = "gemini-3.6-flash"
# ponytail: budgets N tool calls + 1 final-text round <= MAX_TOOL_ROUNDS, so this
# allows at most 3 tool calls before a final answer is required. Raise if a
# real question needs to call all 3 tools AND still get a final-text round.
MAX_TOOL_ROUNDS = 4
FALLBACK_MESSAGE = (
    "I can only answer using real fare data, and couldn't find a grounded way to "
    "answer that question. Try asking about a specific route (DEL-BOM, DEL-BLR, or "
    "BOM-BLR), a time period, or how the index is calculated."
)

_VALID_ROUTES = {"DEL-BOM", "DEL-BLR", "BOM-BLR"}
_VALID_FREQUENCIES = {"daily", "weekly", "monthly"}

SYSTEM_INSTRUCTION = (
    "You are Ask APIx, answering questions about SkyMetrics' real Indian domestic "
    "airfare index and fare data. You must ALWAYS call one of the provided functions "
    "to retrieve real data before answering any question about fares, index values, "
    "routes, or methodology -- never state a number you did not receive from a "
    "function call. If a question cannot be answered with the available functions "
    "(get_index, get_fare_records, get_metadata), say so plainly instead of guessing. "
    "When you do have real data, answer concisely in plain English, citing the actual "
    "numbers returned."
)

_TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="get_index",
            description=(
                "Returns the real computed APIx index series -- simple_relative, "
                "laspeyres, paasche, fisher -- for the given frequency and optional "
                "date range. Use this for questions about the overall index or "
                "formula values, not individual fare prices."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "frequency": types.Schema(
                        type="STRING",
                        enum=["daily", "weekly", "monthly"],
                        description="Index frequency.",
                    ),
                    "start": types.Schema(
                        type="STRING",
                        description="Optional start date/period, ISO format (e.g. 2026-08-01).",
                    ),
                    "end": types.Schema(
                        type="STRING",
                        description="Optional end date/period, ISO format.",
                    ),
                },
                required=["frequency"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_fare_records",
            description=(
                "Returns real individual fare quotes and their mean, optionally "
                "filtered by route, carrier, advance-purchase window, fare class, "
                "and date range. Use this for questions about actual prices, "
                "specific routes, or lead-time/advance-window comparisons."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "route": types.Schema(
                        type="ARRAY",
                        items=types.Schema(
                            type="STRING", enum=["DEL-BOM", "DEL-BLR", "BOM-BLR"]
                        ),
                        description="Optional list of routes to filter by.",
                    ),
                    "carrier": types.Schema(
                        type="STRING", description="Optional carrier code, e.g. QP."
                    ),
                    "advance_window": types.Schema(
                        type="STRING",
                        enum=["T+1", "T+7", "T+15", "T+30", "T+45"],
                        description="Optional advance-purchase window.",
                    ),
                    "fare_class": types.Schema(
                        type="STRING", description="Optional fare class code."
                    ),
                    "start": types.Schema(
                        type="STRING", description="Optional start date, ISO format."
                    ),
                    "end": types.Schema(
                        type="STRING", description="Optional end date, ISO format."
                    ),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="get_metadata",
            description=(
                "Returns the real route weights, formula descriptions, and "
                "available index snapshots. Use this for questions about "
                "methodology, how the index is calculated, or what routes/weights "
                "are used."
            ),
            parameters=types.Schema(type="OBJECT", properties={}),
        ),
    ]
)


def _tool_get_index(args: dict, conn) -> dict:
    frequency = args.get("frequency")
    if frequency not in _VALID_FREQUENCIES:
        return {
            "error": f"Invalid frequency: {frequency!r}. "
            f"Expected one of {', '.join(sorted(_VALID_FREQUENCIES))}."
        }
    try:
        return load_snapshot(
            conn, frequency, comparison_id=None, start=args.get("start"), end=args.get("end")
        )
    except SnapshotNotFoundError as exc:
        return {"error": str(exc)}


def _tool_get_fare_records(args: dict, conn) -> dict:
    routes = args.get("route")
    if routes:
        invalid = sorted(set(routes) - _VALID_ROUTES)
        if invalid:
            return {
                "error": f"Invalid route(s): {', '.join(invalid)}. "
                f"Expected one of {', '.join(sorted(_VALID_ROUTES))}."
            }
    try:
        return load_fare_record_table(
            conn,
            routes=routes,
            sources=None,
            carrier=args.get("carrier"),
            advance_window=args.get("advance_window"),
            fare_class=args.get("fare_class"),
            start=args.get("start"),
            end=args.get("end"),
        )
    except (ValueError, TypeError) as exc:
        # TypeError, not just ValueError: datetime.fromisoformat (inside
        # load_fare_record_table -> load_fare_records -> _parse_datetime)
        # raises TypeError, not ValueError, when given a non-string value --
        # a real possibility since Gemini's JSON output isn't a fully
        # enforced contract, just a schema hint.
        return {"error": str(exc)}


def _tool_get_metadata(args: dict, conn) -> dict:
    return {
        "weights": load_weights_metadata(),
        "formulas": {
            "simple_relative": "Equal-weighted arithmetic mean of price relatives.",
            "laspeyres": "Base-period-weighted arithmetic mean of price relatives.",
            "paasche": "Current-period-weighted harmonic mean of price relatives.",
            "fisher": "Geometric mean of Laspeyres and Paasche.",
        },
        "snapshots": list_snapshots(conn),
    }


_DISPATCH = {
    "get_index": _tool_get_index,
    "get_fare_records": _tool_get_fare_records,
    "get_metadata": _tool_get_metadata,
}


def _execute_tool(name: str, args: dict, conn) -> dict:
    handler = _DISPATCH.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name!r}"}
    return handler(args, conn)


_ROLE_MAP = {"user": "user", "assistant": "model"}


def _history_to_contents(history: list[dict]) -> list:
    contents = []
    for turn in history:
        role = turn["role"]
        if role not in _ROLE_MAP:
            raise ValueError(
                f"Unknown chat history role: {role!r}. Expected 'user' or 'assistant'."
            )
        contents.append(types.Content(role=_ROLE_MAP[role], parts=[types.Part(text=turn["text"])]))
    return contents


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is not set. "
            "Set it to a valid Gemini API key before calling /api/v1/ask."
        )
    return genai.Client(api_key=api_key)


def answer_question(
    question: str, history: list[dict], conn, client: genai.Client | None = None
) -> dict:
    """Answer a question using only real data. Returns
    {"answer": str, "tool_calls": [{"name": str, "args": dict, "result": dict}, ...]}.

    Enforcement: the loop only ever returns model-generated text once at least
    one real tool call has executed in this turn. A first response that isn't
    a tool call is discarded entirely -- FALLBACK_MESSAGE is returned instead,
    never that untrusted text.
    """
    if client is None:
        client = _get_client()

    contents = _history_to_contents(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=question)]))
    config = types.GenerateContentConfig(tools=[_TOOLS], system_instruction=SYSTEM_INSTRUCTION)

    tool_calls: list[dict] = []
    for round_index in range(MAX_TOOL_ROUNDS):
        response = client.models.generate_content(
            model=GEMINI_MODEL, contents=contents, config=config
        )
        part = response.candidates[0].content.parts[0]

        if part.function_call is None:
            if tool_calls:
                return {"answer": part.text, "tool_calls": tool_calls}
            return {"answer": FALLBACK_MESSAGE, "tool_calls": []}

        name = part.function_call.name
        args = dict(part.function_call.args)
        result = _execute_tool(name, args, conn)
        tool_calls.append({"name": name, "args": args, "result": result})

        contents.append(response.candidates[0].content)
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_function_response(name=name, response=result)],
            )
        )

    return {"answer": FALLBACK_MESSAGE, "tool_calls": tool_calls}
