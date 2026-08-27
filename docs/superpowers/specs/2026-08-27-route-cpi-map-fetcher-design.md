# SkyMetrics Route CPI Map Fetcher Design

## Context

The dashboard needs a default India map view for SIH26056 that shows airport
cities as nodes and route-level CPI as links. The visual edge is undirected so
the map stays readable, but the data model remains directed because DEL-BOM and
BOM-DEL can have different prices, availability, and source coverage.

This change deliberately does not modify `scraper/index` or any scraper source.
The precompute writer is owned by the next data task. This slice creates the
database contract, API fetcher, airport-city configuration, dashboard-local map
renderer, and optional demo seed data.

## Data Contract

`map_city_nodes`

- One row per city-level node shown on the map.
- `city_code` is the primary key and uses a representative airport code.
- `airport_codes` stores every airport code grouped into that city node.
- `is_active` allows hiding a city without deleting its history.
- The dashboard renders from `dashboard/src/config/airportCities.json`; this DB
  table exists for foreign keys and future admin/precompute ownership, not for
  request-time map rendering.

`map_route_cpi_edges`

- One row per directed city-to-city CPI value.
- `snapshot_id`, `frequency`, and `period` identify a precomputed batch.
- `origin_city_code` and `destination_city_code` reference `map_city_nodes`.
- `route_key` is directed, e.g. `DEL-BOM`.
- `quote_count`, `available_count`, `no_flight_count`, and `source_count` are
  stored with the CPI so the dashboard tooltip can explain source health.
- Request-time code only fetches and groups rows; it does not compute CPI.

## API

`GET /api/v1/map/routes`

Query params:

- `frequency`: `daily`, `weekly`, or `monthly`.
- `snapshot_id`: optional exact precompute batch.
- `period`: optional exact period.
- `route`: optional repeated directed route filters such as `DEL-BOM`.

If `snapshot_id` or `period` is omitted, the API selects the newest matching
precomputed map snapshot by `written_at`. When a route filter is provided, the
query expands it with the reverse direction so the frontend can show both-way
tooltip panels from one visual edge.

Response shape:

- `edges`: grouped visual edges keyed as `CITY_A|CITY_B`, each containing
  `city_a_to_b` and `city_b_to_a` directed payloads. Either direction can be
  `null` when there is no data.

The endpoint intentionally returns CPI edge data only. Map geometry, nodes, and
blank route links are built entirely by the dashboard.

Malformed route filters return `422` with a dashboard-readable message.

## Dashboard

The `Map` tab is now the first/default dashboard view. It renders:

- All configured Indian airport cities as nodes.
- Selected route links as neutral lines when no CPI exists yet.
- CPI-colored links when data is available: below 98, 98-102, above 102.
- A split hover tooltip showing each direction separately.
- A blank panel for a missing direction, matching the requirement to show a
  blank popup when no data exists.
- The full map even when the CPI fetch fails, with a non-blocking error message
  above the rendered map.

The map uses `react-simple-maps` with a local India states GeoJSON asset and
`d3-scale` for CPI color thresholds.
