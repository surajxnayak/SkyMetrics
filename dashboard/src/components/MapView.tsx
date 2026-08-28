import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Line, Marker } from "react-simple-maps";
import { scaleThreshold } from "d3-scale";
import { useFilters } from "../context/FilterContext";
import { useMapRoutes } from "../hooks/useMapRoutes";
import airportCitiesConfig from "../config/airportCities.json";
import type { MapDirection, MapEdge } from "../api/types";

const GEO_URL = "/maps/india-states-simplified.geojson";

interface AirportCity {
  city_code: string;
  city_name: string;
  latitude: number;
  longitude: number;
  airport_codes: string[];
}

// The full config lists 161 airports -- rendering all of them as labeled
// nodes would be unreadable clutter, especially with only 3 routes
// carrying real data today. This is the set of major metros worth showing
// on a first pass; expand as real route coverage grows.
const DISPLAY_CITY_CODES = [
  "DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "AMD", "PNQ",
  "GOI", "COK", "JAI", "LKO", "PAT", "GAU", "IXC", "IDR",
];

const CITY_NODES: AirportCity[] = (
  airportCitiesConfig as { cities: AirportCity[] }
).cities.filter((city) => DISPLAY_CITY_CODES.includes(city.city_code));

const CITY_BY_CODE = new Map(CITY_NODES.map((city) => [city.city_code, city]));

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

export default function MapView() {
  const { appliedFilters } = useFilters();
  const { data, loading, error } = useMapRoutes({ frequency: appliedFilters.frequency });
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const edges = data?.edges ?? [];
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

      <div className="relative h-[75vh] min-h-[520px] w-full overflow-hidden bg-inset">
        {loading && !data ? (
          <p className="p-4 text-sm text-secondary">Loading map...</p>
        ) : (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [82.8, 23.2], scale: 1500 }}
            width={900}
            height={800}
            style={{ width: "100%", height: "100%" }}
            role="img"
            aria-label="Map of India showing airport city nodes and route coverage"
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="var(--color-surface-container)"
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
                <Line
                  key={edge.edge_key}
                  from={[cityA.longitude, cityA.latitude]}
                  to={[cityB.longitude, cityB.latitude]}
                  stroke={cpiColor(direction.cpi)}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeOpacity={isSelected ? 0.9 : 0.25}
                  strokeLinecap="round"
                />
              );
            })}

            {CITY_NODES.map((city) => {
              const isSelected = selectedCity === city.city_code;
              return (
                <Marker
                  key={city.city_code}
                  coordinates={[city.longitude, city.latitude]}
                  onClick={() => setSelectedCity(isSelected ? null : city.city_code)}
                >
                  <circle
                    r={isSelected ? 7 : 5}
                    fill={isSelected ? "var(--color-accent)" : "var(--color-secondary)"}
                    stroke="var(--color-inset)"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                  />
                  <text
                    textAnchor="middle"
                    y={-12}
                    className="pointer-events-none select-none fill-secondary font-mono text-[10px] uppercase tracking-wide"
                  >
                    {city.city_name}
                  </text>
                </Marker>
              );
            })}
          </ComposableMap>
        )}

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
