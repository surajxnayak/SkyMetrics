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
    written_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS index_points_comparison_id_idx ON index_points (comparison_id);
CREATE INDEX IF NOT EXISTS index_points_frequency_period_idx ON index_points (frequency, period);
