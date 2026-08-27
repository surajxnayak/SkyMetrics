-- Optional demo seed for the route CPI map.
--
-- Run after db/schema.sql has been applied:
--   psql "$DATABASE_URL" -f db/seed_map_dummy.sql
--
-- CPI values are demo values, not official route-level statistics. They are
-- anchored around the publicly reported DGCA/Parliament statement that average
-- domestic airfares on 72 sectors rose about 20.5% from March 2025 to June 2026.

INSERT INTO map_city_nodes
    (city_code, city_name, latitude, longitude, airport_codes, is_active, metadata)
VALUES
    ('DEL', 'Delhi', 28.5562, 77.1000, ARRAY['DEL', 'DXN', 'HDO'], true,
     '{"source":"OurAirports city config; DXN/HDO grouped into Delhi for city-level map display"}'),
    ('BOM', 'Mumbai', 19.0887, 72.8679, ARRAY['BOM'], true,
     '{"source":"OurAirports city config"}'),
    ('BLR', 'Bengaluru', 13.1986, 77.7066, ARRAY['BLR'], true,
     '{"source":"OurAirports city config"}'),
    ('MAA', 'Chennai', 12.9900, 80.1693, ARRAY['MAA'], true,
     '{"source":"OurAirports city config"}'),
    ('HYD', 'Hyderabad', 17.2313, 78.4299, ARRAY['HYD'], true,
     '{"source":"OurAirports city config"}'),
    ('CCU', 'Kolkata', 22.6547, 88.4467, ARRAY['CCU'], true,
     '{"source":"OurAirports city config"}')
ON CONFLICT (city_code) DO UPDATE SET
    city_name = EXCLUDED.city_name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    airport_codes = EXCLUDED.airport_codes,
    is_active = EXCLUDED.is_active,
    metadata = EXCLUDED.metadata;

DELETE FROM map_route_cpi_edges
WHERE snapshot_id IN ('demo-map-daily-2026-08-27', 'demo-map-monthly-2026-06');

INSERT INTO map_route_cpi_edges
    (snapshot_id, frequency, period, base_period, origin_city_code, destination_city_code,
     route_key, cpi, quote_count, available_count, no_flight_count, source_count, metadata)
VALUES
    ('demo-map-daily-2026-08-27', 'daily', '2026-08-27', '2025-08-27',
     'DEL', 'BOM', 'DEL-BOM', 121.2, 226, 226, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-daily-2026-08-27', 'daily', '2026-08-27', '2025-08-27',
     'BOM', 'DEL', 'BOM-DEL', 119.8, 218, 218, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-daily-2026-08-27', 'daily', '2026-08-27', '2025-08-27',
     'DEL', 'BLR', 'DEL-BLR', 122.4, 196, 195, 1, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-daily-2026-08-27', 'daily', '2026-08-27', '2025-08-27',
     'BLR', 'DEL', 'BLR-DEL', 120.7, 204, 204, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-daily-2026-08-27', 'daily', '2026-08-27', '2025-08-27',
     'BOM', 'BLR', 'BOM-BLR', 118.9, 174, 173, 1, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-daily-2026-08-27', 'daily', '2026-08-27', '2025-08-27',
     'BLR', 'BOM', 'BLR-BOM', 119.5, 181, 181, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-monthly-2026-06', 'monthly', '2026-06', '2025-03',
     'DEL', 'BOM', 'DEL-BOM', 121.2, 226, 226, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-monthly-2026-06', 'monthly', '2026-06', '2025-03',
     'BOM', 'DEL', 'BOM-DEL', 119.8, 218, 218, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-monthly-2026-06', 'monthly', '2026-06', '2025-03',
     'DEL', 'BLR', 'DEL-BLR', 122.4, 196, 195, 1, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-monthly-2026-06', 'monthly', '2026-06', '2025-03',
     'BLR', 'DEL', 'BLR-DEL', 120.7, 204, 204, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-monthly-2026-06', 'monthly', '2026-06', '2025-03',
     'BOM', 'BLR', 'BOM-BLR', 118.9, 174, 173, 1, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}'),
    ('demo-map-monthly-2026-06', 'monthly', '2026-06', '2025-03',
     'BLR', 'BOM', 'BLR-BOM', 119.5, 181, 181, 0, 1,
     '{"kind":"demo","basis":"DGCA reported about 20.5 percent average domestic airfare rise across 72 sectors; route spread is illustrative"}');
