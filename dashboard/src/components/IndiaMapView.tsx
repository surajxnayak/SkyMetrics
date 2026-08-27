import { useMemo, useState } from "react";
import { scaleThreshold } from "d3-scale";
import { ComposableMap, Geographies, Geography, Line, Marker } from "react-simple-maps";
import type { MapDirection, MapEdge, MapNode } from "../api/types";
import airportCities from "../config/airportCities.json";
import { useFilters } from "../context/FilterContext";
import { useMapRoutes } from "../hooks/useMapRoutes";

const INDIA_GEO_URL = "/maps/india-states-simplified.geojson";
const MAJOR_CITY_CODES = new Set(["DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "AMD", "GOI"]);
const CPI_COLOR = scaleThreshold<number, string>()
  .domain([98, 102])
  .range(["#4ade80", "#f0b429", "#f87171"]);

const MAP_NODES = airportCities.cities.map((city) => ({
  city_code: city.city_code,
  city_name: city.city_name,
  latitude: city.latitude,
  longitude: city.longitude,
  airport_codes: city.airport_codes,
})) satisfies MapNode[];

type TooltipState = {
  x: number;
  y: number;
  origin: string;
  destination: string;
  forward: MapDirection | null;
  reverse: MapDirection | null;
} | null;

function canonicalEdgeKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function directionFor(edge: MapEdge | undefined, origin: string, destination: string) {
  if (!edge) return null;
  for (const direction of [edge.city_a_to_b, edge.city_b_to_a]) {
    if (
      direction &&
      direction.origin_city_code === origin &&
      direction.destination_city_code === destination
    ) {
      return direction;
    }
  }
  return null;
}

function edgeCpi(forward: MapDirection | null, reverse: MapDirection | null): number | null {
  const values = [forward?.cpi, reverse?.cpi].filter((value): value is number => value !== undefined);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function colorForCpi(cpi: number | null): string {
  if (cpi === null) return "#3b4454";
  return CPI_COLOR(cpi);
}

function formatCpi(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}

function DirectionPanel({ title, direction }: { title: string; direction: MapDirection | null }) {
  return (
    <div className="min-w-40 flex-1">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">{title}</h3>
      {direction ? (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-secondary">CPI</dt>
            <dd className="font-mono text-primary">{formatCpi(direction.cpi)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-secondary">Quotes</dt>
            <dd className="font-mono text-primary">{direction.quote_count}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-secondary">Available</dt>
            <dd className="font-mono text-primary">{direction.available_count}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-secondary">No-flight</dt>
            <dd className="font-mono text-primary">{direction.no_flight_count}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-secondary">Base</dt>
            <dd className="font-mono text-primary">{direction.base_period}</dd>
          </div>
        </dl>
      ) : (
        <div className="h-28 rounded border border-line bg-inset" />
      )}
    </div>
  );
}

export default function IndiaMapView() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useMapRoutes({
    frequency: filters.frequency,
    routes: filters.selectedRoutes,
  });
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const nodesByCode = useMemo(() => {
    const nodes = new Map<string, MapNode>();
    for (const node of MAP_NODES) nodes.set(node.city_code, node);
    return nodes;
  }, []);

  const edgesByKey = useMemo(() => {
    const edges = new Map<string, MapEdge>();
    for (const edge of data?.edges ?? []) edges.set(edge.edge_key, edge);
    return edges;
  }, [data]);

  const selectedEdges = useMemo(() => {
    return filters.selectedRoutes
      .map((route) => {
        const [origin, destination] = route.split("-");
        const originNode = nodesByCode.get(origin);
        const destinationNode = nodesByCode.get(destination);
        if (!originNode || !destinationNode) return null;
        const edge = edgesByKey.get(canonicalEdgeKey(origin, destination));
        const forward = directionFor(edge, origin, destination);
        const reverse = directionFor(edge, destination, origin);
        return { origin, destination, originNode, destinationNode, forward, reverse };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
  }, [edgesByKey, filters.selectedRoutes, nodesByCode]);

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          CPI overlay unavailable: {error}. Showing the map without fetched CPI data.
        </p>
      )}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-primary">Route CPI map</h2>
          <p className="font-mono text-sm text-secondary">
            {data?.period
              ? `CPI period: ${data.period}`
              : loading
                ? "Fetching CPI overlay..."
                : "No CPI overlay loaded"}{" "}
            / Nodes: {MAP_NODES.length}
          </p>
        </div>
        <div className="flex gap-3 text-xs text-secondary">
          <span><span className="mr-1 inline-block h-2 w-6 rounded bg-up" />Below 98</span>
          <span><span className="mr-1 inline-block h-2 w-6 rounded bg-warning" />98-102</span>
          <span><span className="mr-1 inline-block h-2 w-6 rounded bg-down" />Above 102</span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-md border border-line bg-inset">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [82.8, 22.5], scale: 1050 }}
          width={900}
          height={760}
          className="h-[680px] w-full"
        >
          <Geographies geography={INDIA_GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#12161f"
                  stroke="#334155"
                  strokeWidth={0.6}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#171d28", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {selectedEdges.map(({ origin, destination, originNode, destinationNode, forward, reverse }) => {
            const cpi = edgeCpi(forward, reverse);
            return (
              <Line
                key={`${origin}-${destination}`}
                from={[originNode.longitude, originNode.latitude]}
                to={[destinationNode.longitude, destinationNode.latitude]}
                stroke={colorForCpi(cpi)}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeOpacity={cpi === null ? 0.55 : 0.9}
                onMouseEnter={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    origin,
                    destination,
                    forward,
                    reverse,
                  })
                }
                onMouseMove={(event) =>
                  setTooltip((current) =>
                    current ? { ...current, x: event.clientX, y: event.clientY } : current
                  )
                }
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
          {MAP_NODES.map((node) => (
            <Marker
              key={node.city_code}
              coordinates={[node.longitude, node.latitude]}
              onMouseEnter={(event) =>
                setTooltip({
                  x: event.clientX,
                  y: event.clientY,
                  origin: node.city_code,
                  destination: node.city_code,
                  forward: null,
                  reverse: null,
                })
              }
              onMouseMove={(event) =>
                setTooltip((current) =>
                  current ? { ...current, x: event.clientX, y: event.clientY } : current
                )
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <circle r={MAJOR_CITY_CODES.has(node.city_code) ? 3.5 : 2} fill="#e5e7eb" />
              {MAJOR_CITY_CODES.has(node.city_code) && (
                <text y={-6} textAnchor="middle" className="fill-primary text-[10px] font-medium">
                  {node.city_code}
                </text>
              )}
            </Marker>
          ))}
        </ComposableMap>
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 max-w-xl rounded-md border border-line bg-panel p-4 shadow-xl"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            {tooltip.origin === tooltip.destination ? (
              <div>
                <h3 className="text-sm font-semibold text-primary">{tooltip.origin}</h3>
                <p className="mt-2 text-sm text-secondary">No route CPI selected for this city.</p>
              </div>
            ) : (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  {tooltip.origin} - {tooltip.destination}
                </h3>
                <div className="flex gap-4">
                  <DirectionPanel
                    title={`${tooltip.origin} -> ${tooltip.destination}`}
                    direction={tooltip.forward}
                  />
                  <div className="w-px bg-line" />
                  <DirectionPanel
                    title={`${tooltip.destination} -> ${tooltip.origin}`}
                    direction={tooltip.reverse}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
