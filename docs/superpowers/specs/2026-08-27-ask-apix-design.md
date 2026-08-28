# Ask APIx — Design

## Purpose

A natural-language query interface over SkyMetrics' real airfare index/fare data,
powered by Google Gemini Flash via function-calling. This is the project's first AI
feature, chosen as the single most demo-visible, judge-facing addition on top of the
already-complete deterministic scraper → index → API → dashboard pipeline. It directly
serves two PRD personas: the **RBI Analyst** ("timely trend signals... via API") and the
**Economist/Researcher** ("lead-time elasticity, seasonality, route-level breakdowns") —
both currently have to manually configure dashboard filters and read charts to answer a
question; this lets them ask the question directly.

**Non-negotiable constraint, carried over from the rest of this project's "real data
only" discipline:** the model must never state a fare or index number it did not receive
from a real API call. It is not answering from its own knowledge — it is translating a
question into the right real API call, then narrating only what that call actually
returned.

## Architecture

```
Dashboard (new "Ask APIx" tab)
    |
    v
POST /api/v1/ask  { question, history }      (new FastAPI endpoint, same
    |                                          X-API-Key auth + rate limit
    v                                          as every other endpoint)
api/ask.py: ask_gemini(question, history, conn)
    |
    v
Gemini Flash, called with 3 function declarations bound to real functions:
  - get_index(frequency, start, end)          -> api/data_access.py::load_snapshot
  - get_fare_records(route, carrier,           -> api/data_access.py::load_fare_record_table
      advance_window, fare_class, start, end)
  - get_metadata()                             -> api/data_access.py::load_weights_metadata
                                                   + list_snapshots
    |
    v
Gemini requests a function call (manual function-calling, not the SDK's
auto-calling helper) -> backend executes the real call against Postgres
-> real JSON result sent back to Gemini as the function response -> Gemini
writes the final answer, instructed to cite only values present in that
JSON.
```

**Why manual function-calling, not the SDK's automatic mode:** manual calling means the
backend inspects Gemini's first response itself. If that response is a function call, the
backend executes it and continues the conversation. If it is NOT a function call (i.e.
Gemini tried to answer directly, from its own reasoning, without grounding), the backend
**rejects that turn outright** and returns a fixed fallback message instead of forwarding
an ungrounded answer to the user. This is the actual enforcement mechanism — not a prompt
instruction hoping the model behaves, but a code-level gate that only ever lets a
tool-grounded answer reach the user.

**Why a backend endpoint, not a direct-from-browser Gemini call:** a Gemini key has
billing attached to it, unlike this project's existing demo-scoped `SKYMETRICS_API_KEYS`.
Keeping it server-side, following the same pattern as `DATABASE_URL`, means it never
reaches the browser bundle.

**Why client-side, stateless conversation history:** the frontend keeps the message list
in React state and resends it each turn. No new database table, no session store — matches
the project's existing "don't add state you don't need" discipline (the API layer is
already documented as doing "no request-time recomputation," and this follows the same
minimal-state spirit).

## Backend: `api/ask.py`

New module. One function, `answer_question(question: str, history: list[dict], conn) ->
dict`, returning `{"answer": str, "tool_calls": [{"name": str, "args": dict, "result":
dict}]}` — the `tool_calls` list is what lets the frontend show "data used" alongside the
answer, making the grounding verifiable rather than just claimed.

Three function declarations, matching the real endpoints' real parameters exactly (same
validation as the endpoints already enforce — routes restricted to the real 3-route
basket, frequency to daily/weekly/monthly, etc., reusing the existing validators from
`api/main.py` rather than duplicating them):

- `get_index(frequency: str, start: str | None, end: str | None)`
- `get_fare_records(route: list[str] | None, carrier: str | None, advance_window: str |
  None, fare_class: str | None, start: str | None, end: str | None)`
- `get_metadata()`

Each function declaration's description tells Gemini exactly what real data it returns
(e.g. "Returns the real computed APIx index series — simple_relative, laspeyres, paasche,
fisher — for the given frequency and date range.") so the model can choose correctly
between `get_index` (aggregate index formulas) and `get_fare_records` (raw fare
statistics) based on what the question is actually asking.

If the requested route(s)/frequency/etc. fail the same validation the real REST endpoints
already enforce, the tool execution returns a structured error (not an exception that
crashes the turn) — e.g. `{"error": "Invalid route: XYZ-ABC. Expected one of DEL-BOM,
DEL-BLR, BOM-BLR."}` — which gets fed back to Gemini as the function response, so it can
tell the user their question referenced an invalid route, grounded in the real validation
rule, not a guess.

## New endpoint

```
POST /api/v1/ask
Headers: X-API-Key: <key>
Body: { "question": "How did DEL-BOM fares move last month?", "history": [...] }
Response: { "answer": "...", "tool_calls": [...] }
```

Added to the existing `router` in `api/main.py` (same `Depends(require_api_key)`,
`Depends(enforce_rate_limit)` as every other route — no separate limit, the existing 60
requests/minute is generous for a chat interface).

## Frontend

New 5th tab in the icon rail, "Ask APIx" (icon: `chat` or `psychology` from Material
Symbols — implementer's call, matching the icon-per-tab pattern already established in
`App.tsx`). Chat-style UI: message list (user questions right-aligned, assistant answers
left-aligned, matching the existing dark theme tokens) + a text input + send button. Each
assistant message has a collapsed "Data used" disclosure that expands to show the real
tool call(s) and their raw JSON result — this is the trust/audit surface, not just a debug
aid.

New `dashboard/src/api/client.ts` function: `askQuestion(question: string, history:
Message[]): Promise<AskResponse>`, POSTing to `/api/v1/ask`, following the exact same
`get`/error-handling pattern already in that file (adapted for POST).

New `dashboard/src/hooks/useAsk.ts` managing the message list state client-side (no
persistence — a page refresh clears the conversation, which is an acceptable and simple
default, not a gap).

## Configuration

New environment variable `GEMINI_API_KEY`, read server-side only, following the exact
"fail loudly if unset" pattern `api/auth.py` already uses for `SKYMETRICS_API_KEYS` — the
`/ask` endpoint refuses to start answering (clear 500 with a real error message, not a
silent failure) if the key is missing, rather than defaulting to anything. Documented in
`.env.example` alongside the existing two variables.

New dependency: `google-genai` (the official Gemini Python SDK), added to
`requirements.txt`.

## Testing

- **Tool-execution unit tests** (no Gemini calls): given a tool-call request with specific
  args, does `api/ask.py` call the right real `api/data_access.py` function with the right
  params and return real data? Fully testable against the real test database, same
  pattern as every other `api/data_access.py` test in this project.
- **Grounding-enforcement unit test**: given a mocked Gemini response that is NOT a
  function call, confirm the backend returns the fixed fallback message, not the model's
  raw text — this is the single most important test in the whole feature, since it's the
  actual enforcement mechanism.
- **Gemini call itself is mocked** in all automated tests (matching how
  `dashboard/src/__tests__/*.test.tsx` already mock `../api/client` rather than hitting a
  real backend) — no real Gemini API calls in CI, keeping tests fast, free, and
  deterministic. A real end-to-end manual check (real question, real Gemini call, real
  data) happens once during final verification, same as this project's established
  practice of testing UI/integration changes live before calling a task done.

## Non-goals

- No persisted conversation history (no new DB table, no session store) — client-side
  only, cleared on refresh.
- No new derived metrics — `get_index`/`get_fare_records`/`get_metadata` map 1:1 to
  existing, already-computed data. The model narrates, it does not compute anything the
  rest of the system doesn't already compute.
- No streaming responses (token-by-token) for this first version — a single request/single
  response per turn, matching the simplicity of the rest of this project's API design.
- No automatic function-calling (the SDK's built-in auto-loop) — manual calling only, so
  the grounding gate can actually inspect and enforce.
- No rate limit separate from the existing per-key limit already enforced on every
  endpoint.
