CREATE TABLE IF NOT EXISTS fare_quotes (
    quote_id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    carrier TEXT NOT NULL,
    source TEXT NOT NULL,
    travel_date DATE NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    advance_window TEXT NOT NULL,
    fare_class TEXT,
    base_fare NUMERIC,
    taxes NUMERIC,
    udf NUMERIC,
    convenience_fee NUMERIC,
    total_fare NUMERIC,
    status TEXT NOT NULL,
    run_id TEXT NOT NULL,
    fee_breakdown JSONB,
    routing TEXT,
    is_outlier BOOLEAN NOT NULL,
    source_quote_ids TEXT[] NOT NULL
);

CREATE INDEX IF NOT EXISTS fare_quotes_origin_destination_idx ON fare_quotes (origin, destination);
CREATE INDEX IF NOT EXISTS fare_quotes_collected_at_idx ON fare_quotes (collected_at);

CREATE TABLE IF NOT EXISTS index_points (
    id BIGSERIAL PRIMARY KEY,
    comparison_id TEXT NOT NULL,
    frequency TEXT NOT NULL,
    period TEXT NOT NULL,
    base_period TEXT NOT NULL,
    routes TEXT[] NOT NULL,
    simple_relative NUMERIC NOT NULL,
    laspeyres NUMERIC,
    paasche NUMERIC,
    fisher NUMERIC,
    -- clock_timestamp(), not now(): now() returns the transaction's start
    -- time, so multiple rows inserted in one transaction (e.g. one cron
    -- run's whole snapshot) would all get an identical written_at, breaking
    -- "newest first" ordering between them. clock_timestamp() is real
    -- wall-clock time at each row's insertion.
    written_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS index_points_comparison_id_idx ON index_points (comparison_id);
CREATE INDEX IF NOT EXISTS index_points_frequency_period_idx ON index_points (frequency, period);

CREATE TABLE IF NOT EXISTS map_city_nodes (
    city_code TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    airport_codes TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS map_route_cpi_edges (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id TEXT NOT NULL,
    frequency TEXT NOT NULL,
    period TEXT NOT NULL,
    base_period TEXT NOT NULL,
    origin_city_code TEXT NOT NULL REFERENCES map_city_nodes(city_code),
    destination_city_code TEXT NOT NULL REFERENCES map_city_nodes(city_code),
    route_key TEXT NOT NULL,
    cpi NUMERIC NOT NULL,
    quote_count INTEGER NOT NULL DEFAULT 0,
    available_count INTEGER NOT NULL DEFAULT 0,
    no_flight_count INTEGER NOT NULL DEFAULT 0,
    source_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,
    written_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS map_route_cpi_edges_snapshot_idx
    ON map_route_cpi_edges (snapshot_id);
CREATE INDEX IF NOT EXISTS map_route_cpi_edges_frequency_period_idx
    ON map_route_cpi_edges (frequency, period);
CREATE INDEX IF NOT EXISTS map_route_cpi_edges_origin_destination_idx
    ON map_route_cpi_edges (origin_city_code, destination_city_code);
CREATE INDEX IF NOT EXISTS map_route_cpi_edges_written_at_idx
    ON map_route_cpi_edges (written_at DESC);
