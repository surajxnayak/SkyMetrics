import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { scaleThreshold } from "d3-scale";
import { useFilters } from "../context/FilterContext";
import { useMapRoutes } from "../hooks/useMapRoutes";
import airportCitiesConfig from "../config/airportCities.json";
import type { MapDirection, MapEdge } from "../api/types";

const GEO_URL = "/maps/india-states-simplified.geojson";
// Natural Earth 1:110m countries, via the world-atlas npm package (public
// domain) -- a faint backdrop of the rest of the world so India doesn't
// float in an empty void, purely decorative (no data attached to it).
const WORLD_GEO_URL = "/maps/world-countries-110m.json";

interface AirportCity {
  city_code: string;
  city_name: string;
  latitude: number;
  longitude: number;
  airport_codes: string[];
}

// Major metros stay labeled; every airport node remains interactive.
const DISPLAY_CITY_CODES = [
  "DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "AMD", "PNQ",
  "GOI", "COK", "JAI", "LKO", "PAT", "GAU", "IXC", "IDR",
];
const HUB_CODE = "DEL";
const MID_CODES = new Set(["BOM", "BLR", "CCU", "HYD"]);

const ALL_CITIES: AirportCity[] = (airportCitiesConfig as { cities: AirportCity[] }).cities;
const DISPLAY_SET = new Set(DISPLAY_CITY_CODES);
const CITY_NODES: AirportCity[] = ALL_CITIES.filter((city) => DISPLAY_SET.has(city.city_code));

const CITY_BY_CODE = new Map(ALL_CITIES.map((city) => [city.city_code, city]));

// CPI < 98: fares cheaper than base period. 98-102: roughly flat.
// > 102: fares pricier than base period. Reuses the app's existing
// up/down semantic tokens (green = cheaper/good, red = pricier/bad).
const cpiColor = scaleThreshold<number, string>()
  .domain([98, 102])
  .range(["var(--color-up)", "var(--color-warning)", "var(--color-down)"]);

function directionFor(edge: MapEdge, cityCode: string): MapDirection | null {
  if (edge.city_a === cityCode) return edge.city_a_to_b;
  if (edge.city_b === cityCode) return edge.city_b_to_a;
  return null;
}

function otherCity(edge: MapEdge, cityCode: string): string {
  return edge.city_a === cityCode ? edge.city_b : edge.city_a;
}

function nodeRadius(code: string, isSelected: boolean): number {
  if (isSelected) return 9;
  if (!DISPLAY_SET.has(code)) return 2.2;
  if (code === HUB_CODE) return 8;
  if (MID_CODES.has(code)) return 6;
  return 4.5;
}

function projectPoint(longitude: number, latitude: number): [number, number] {
  const centerLongitude = 82.8;
  const centerLatitude = 23.2;
  const scale = 1500;
  const radians = Math.PI / 180;
  const mercatorY = (value: number) => Math.log(Math.tan(Math.PI / 4 + (value * radians) / 2));
  const x = 450 + (longitude - centerLongitude) * radians * scale;
  const y = 400 - (mercatorY(latitude) - mercatorY(centerLatitude)) * scale;
  return [x, y];
}

function curvedEdgePath(cityA: AirportCity, cityB: AirportCity): string {
  const [x1, y1] = projectPoint(cityA.longitude, cityA.latitude);
  const [x2, y2] = projectPoint(cityB.longitude, cityB.latitude);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = Math.min(34, Math.max(12, distance * 0.16));
  const controlX = (x1 + x2) / 2 - (dy / distance) * bend;
  const controlY = (y1 + y2) / 2 + (dx / distance) * bend;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export default function MapView() {
  const { appliedFilters } = useFilters();
  // Real and preview both fetch in parallel; preview (explicitly-flagged
  // illustrative seed data, db/seed_map_dummy.sql) is only ever *displayed*
  // once real data is confirmed empty, and only with the visible "Preview
  // data" label below -- never silently substituted for the real thing.
  const real = useMapRoutes({ frequency: appliedFilters.frequency });
  const preview = useMapRoutes({ frequency: appliedFilters.frequency, preview: true });
  const realIsEmpty = !real.loading && (real.data?.edges.length ?? 0) === 0;
  const usingPreview = realIsEmpty && (preview.data?.edges.length ?? 0) > 0;

  const data = usingPreview ? preview.data : real.data;
  const error = real.error;
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [revealedCity, setRevealedCity] = useState<string | null>(null);

  useEffect(() => {
    if (!hoveredCity) {
      setRevealedCity(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setRevealedCity(hoveredCity), 420);
    return () => window.clearTimeout(timer);
  }, [hoveredCity]);

  const edges = (data?.edges ?? []).filter((edge) => {
    const direction = edge.city_a_to_b ?? edge.city_b_to_a;
    return direction !== null && Number.isFinite(direction.cpi);
  });
  const connectedEdges = useMemo(
    () => (selectedCity ? edges.filter((edge) => edge.city_a === selectedCity || edge.city_b === selectedCity) : []),
    [edges, selectedCity]
  );

  return (
    <div className="w-full">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Failed to load route data: {error}
        </p>
      )}

      <div className="relative h-[75vh] min-h-[520px] w-full overflow-hidden bg-page">
        {usingPreview && (
          <div className="pointer-events-none absolute right-4 top-4 z-10">
            <span className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-panel/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-warning">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
              Preview
            </span>
          </div>
        )}
        <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [82.8, 23.2], scale: 1500 }}
            width={900}
            height={800}
            style={{ width: "100%", height: "100%" }}
            role="img"
            aria-label="Map of India showing airport city nodes and route coverage"
          >
            <Geographies geography={WORLD_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="var(--color-surface-container-low)"
                    stroke="var(--color-line)"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="var(--color-panel)"
                    stroke="var(--color-outline-variant)"
                    strokeWidth={0.6}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "var(--color-surface-container-high)" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {edges.map((edge) => {
              const cityA = CITY_BY_CODE.get(edge.city_a);
              const cityB = CITY_BY_CODE.get(edge.city_b);
              if (!cityA || !cityB) return null;
              const direction = edge.city_a_to_b ?? edge.city_b_to_a;
              if (!direction) return null;
              const isSelected =
                selectedCity === null || selectedCity === edge.city_a || selectedCity === edge.city_b;
              return (
                <path
                  key={edge.edge_key}
                  d={curvedEdgePath(cityA, cityB)}
                  stroke={cpiColor(direction.cpi)}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeOpacity={isSelected ? 0.9 : 0.25}
                  strokeLinecap="round"
                  fill="none"
                  className="map-route-edge"
                />
              );
            })}

            {ALL_CITIES.map((city) => {
              const isSelected = selectedCity === city.city_code;
              const isHovered = hoveredCity === city.city_code;
              const r = nodeRadius(city.city_code, isSelected || isHovered);
              const isNamed = DISPLAY_SET.has(city.city_code);
              return (
                <Marker
                  key={city.city_code}
                  coordinates={[city.longitude, city.latitude]}
                  onClick={() => setSelectedCity(isSelected ? null : city.city_code)}
                  onMouseEnter={() => setHoveredCity(city.city_code)}
                  onMouseLeave={() => setHoveredCity(null)}
                >
                  <circle
                    r={r * 2.4}
                    fill={isSelected ? "var(--color-accent-hover)" : "var(--color-accent)"}
                    opacity={0.35}
                    style={{ filter: "blur(6px)" }}
                    className="map-node-glow cursor-pointer"
                  />
                  <circle
                    r={r}
                    fill={isSelected ? "var(--color-accent-hover)" : "var(--color-accent)"}
                    stroke="var(--color-page)"
                    strokeWidth={1.5}
                    className="map-node cursor-pointer"
                  />
                  {isNamed && <text
                    textAnchor="middle"
                    y={-(r + 8)}
                    className="pointer-events-none select-none fill-primary font-mono text-[10px] uppercase tracking-wide"
                  >
                    {city.city_name}
                  </text>}
                  {revealedCity === city.city_code && (
                    <g className="map-node-tooltip" transform={`translate(${r + 12}, ${-(r + 17)})`}>
                      <rect width="132" height="38" rx="4" fill="var(--color-panel)" stroke="var(--color-accent)" strokeWidth="0.8" />
                      <text x="9" y="15" className="map-node-tooltip-icon material-symbols-outlined">flight</text>
                      <text x="27" y="14" className="map-node-tooltip-title">{city.city_name}</text>
                      <text x="27" y="28" className="map-node-tooltip-copy">{city.airport_codes.join(" / ")} airport</text>
                    </g>
                  )}
                </Marker>
              );
            })}
          </ComposableMap>

        <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5 rounded-sm border border-outline-variant bg-panel/90 p-3 font-mono text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-up)" }} />
            CPI below 98
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-warning)" }} />
            CPI 98-102
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-down)" }} />
            CPI above 102
          </span>
        </div>

        <div className="absolute bottom-4 right-4 w-72 max-w-[calc(100%-2rem)] rounded-sm border border-outline-variant bg-panel/95 p-4">
          <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
            Selected city
          </h3>
          {!selectedCity && (
            <p className="text-sm text-secondary">Click a city on the map to see its route coverage.</p>
          )}
          {selectedCity && (
            <SelectedCityDetail
              city={CITY_BY_CODE.get(selectedCity)!}
              edges={connectedEdges}
              selectedCity={selectedCity}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedCityDetail({
  city,
  edges,
  selectedCity,
}: {
  city: AirportCity;
  edges: MapEdge[];
  selectedCity: string;
}) {
  const priced = edges.filter((edge) => directionFor(edge, selectedCity)?.cpi !== undefined);

  return (
    <>
      <p className="mb-3 text-lg font-semibold text-primary">{city.city_name}</p>
      <div className="mb-3 flex flex-col gap-1.5 rounded-sm border border-outline-variant bg-surface-container-low p-3">
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Airport code:</span>
          <span className="font-mono text-accent">{city.airport_codes.join(", ")}</span>
        </p>
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Connected routes:</span>
          <span className="font-mono text-accent">{edges.length}</span>
        </p>
        <p className="flex items-center justify-between text-sm text-primary">
          <span>With live pricing:</span>
          <span className="font-mono text-accent">{priced.length}</span>
        </p>
      </div>

      {edges.length === 0 ? (
        <p className="text-sm text-secondary">No route coverage for this city yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {edges.map((edge) => {
            const direction = directionFor(edge, selectedCity);
            const other = CITY_BY_CODE.get(otherCity(edge, selectedCity));
            return (
              <li
                key={edge.edge_key}
                className="flex items-center justify-between rounded-sm border border-outline-variant px-2.5 py-1.5 text-sm text-primary"
              >
                <span>{other?.city_name ?? otherCity(edge, selectedCity)}</span>
                {direction ? (
                  <span className="font-mono" style={{ color: cpiColor(direction.cpi) }}>
                    {direction.cpi.toFixed(1)}
                  </span>
                ) : (
                  <span className="font-mono text-secondary">no data</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
