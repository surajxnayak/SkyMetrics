import { useMemo, useState, type MouseEventHandler } from "react";
import { scaleThreshold } from "d3-scale";
import { ComposableMap, Marker, useMapContext } from "react-simple-maps";
import type { Frequency, MapDirection, MapEdge, MapNode } from "../api/types";
import airportCities from "../config/airportCities.json";
import { useMapRoutes } from "../hooks/useMapRoutes";

const MAJOR_CITY_CODES = new Set([
  "DEL",
  "BOM",
  "BLR",
  "MAA",
  "HYD",
  "CCU",
  "AMD",
  "GOI",
  "PNQ",
  "JAI",
  "LKO",
  "PAT",
  "GAU",
  "BBI",
  "VTZ",
  "NAG",
]);

const FALLBACK_DESTINATION_CODES = [
  "BOM",
  "BLR",
  "MAA",
  "HYD",
  "CCU",
  "AMD",
  "GOI",
  "PNQ",
  "JAI",
  "LKO",
  "PAT",
  "GAU",
  "BBI",
  "VTZ",
  "NAG",
  "IXC",
  "IXB",
  "TRV",
  "IXM",
];

const FALLBACK_ROUTE_COUNT = 6;
type GeoPoint = [number, number];

const CPI_COLOR = scaleThreshold<number, string>()
  .domain([98, 102])
  .range(["#6dffb0", "#d7b15f", "#ff7a9b"]);

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

type RenderedRoute = {
  key: string;
  origin: string;
  destination: string;
  originNode: MapNode;
  destinationNode: MapNode;
  forward: MapDirection | null;
  reverse: MapDirection | null;
  fallback: boolean;
};

type RouteArcProps = {
  route: RenderedRoute;
  index: number;
  color: string;
  strokeWidth: number;
  strokeOpacity: number;
  onEnter: MouseEventHandler<SVGPathElement>;
  onMove: MouseEventHandler<SVGPathElement>;
  onLeave: MouseEventHandler<SVGPathElement>;
};

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

function colorForCpi(cpi: number | null, fallback: boolean): string {
  if (fallback || cpi === null) return "#c58cff";
  return CPI_COLOR(cpi);
}

function formatCpi(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}

function routeTarget(edge: MapEdge, origin: string): string | null {
  if (edge.city_a === origin) return edge.city_b;
  if (edge.city_b === origin) return edge.city_a;
  if (edge.city_a_to_b?.origin_city_code === origin) return edge.city_a_to_b.destination_city_code;
  if (edge.city_b_to_a?.origin_city_code === origin) return edge.city_b_to_a.destination_city_code;
  if (edge.city_a_to_b?.destination_city_code === origin) return edge.city_a_to_b.origin_city_code;
  if (edge.city_b_to_a?.destination_city_code === origin) return edge.city_b_to_a.origin_city_code;
  return null;
}

function distanceSquared(origin: MapNode, destination: MapNode): number {
  const longitudeDelta = origin.longitude - destination.longitude;
  const latitudeDelta = origin.latitude - destination.latitude;
  return longitudeDelta * longitudeDelta + latitudeDelta * latitudeDelta;
}

function routeHash(origin: string, destination: string): number {
  const value = `${origin}-${destination}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return hash;
}

function fallbackDestinationNodes(
  origin: string,
  originNode: MapNode,
  nodesByCode: Map<string, MapNode>
): MapNode[] {
  const preferredNodes = FALLBACK_DESTINATION_CODES.map((code) => nodesByCode.get(code)).filter(
    (node): node is MapNode => node !== undefined && node.city_code !== origin
  );

  const nearestPreferred = preferredNodes
    .map((node) => ({ node, distance: distanceSquared(originNode, node) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
    .sort(
      (a, b) =>
        routeHash(origin, a.node.city_code) - routeHash(origin, b.node.city_code) ||
        a.distance - b.distance
    )
    .slice(0, FALLBACK_ROUTE_COUNT)
    .map(({ node }) => node);

  if (nearestPreferred.length >= FALLBACK_ROUTE_COUNT) return nearestPreferred;

  const used = new Set(nearestPreferred.map((node) => node.city_code));
  const fillNodes = MAP_NODES.filter(
    (node) => node.city_code !== origin && !used.has(node.city_code)
  )
    .map((node) => ({ node, distance: distanceSquared(originNode, node) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, FALLBACK_ROUTE_COUNT - nearestPreferred.length)
    .map(({ node }) => node);

  return [...nearestPreferred, ...fillNodes];
}

function RouteArc({
  route,
  index,
  color,
  strokeWidth,
  strokeOpacity,
  onEnter,
  onMove,
  onLeave,
}: RouteArcProps) {
  const { projection } = useMapContext();
  const from = projection([route.originNode.longitude, route.originNode.latitude]) as GeoPoint | null;
  const to = projection([route.destinationNode.longitude, route.destinationNode.latitude]) as GeoPoint | null;

  if (!from || !to) return null;

  const deltaX = to[0] - from[0];
  const deltaY = to[1] - from[1];
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const bend = Math.min(210, Math.max(54, distance * 0.24));
  const stagger = ((index % 3) - 1) * 18;
  const controlX = (from[0] + to[0]) / 2 + stagger;
  const controlY = (from[1] + to[1]) / 2 - bend;
  const pathData = `M ${from[0].toFixed(2)} ${from[1].toFixed(2)} Q ${controlX.toFixed(
    2
  )} ${controlY.toFixed(2)} ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;

  return (
    <g>
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
        strokeOpacity={0}
        className="landing-map__route-hitbox"
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      />
      <path
        d={pathData}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeOpacity={strokeOpacity}
        className="landing-map__route"
        style={{ animationDelay: `${Math.min(index * 45, 900)}ms` }}
      />
    </g>
  );
}

function DirectionPanel({ title, direction }: { title: string; direction: MapDirection | null }) {
  return (
    <div className="min-w-40 flex-1">
      <h3 className="mb-2 text-xs font-medium uppercase text-secondary">{title}</h3>
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
        </dl>
      ) : (
        <p className="text-sm text-secondary">No CPI payload loaded.</p>
      )}
    </div>
  );
}

export default function IndiaMapView() {
  const [selectedCity, setSelectedCity] = useState("DEL");
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const { data, loading, error } = useMapRoutes({
    frequency: "daily" satisfies Frequency,
    originCity: selectedCity,
  });

  const nodesByCode = useMemo(() => {
    const nodes = new Map<string, MapNode>();
    for (const node of MAP_NODES) nodes.set(node.city_code, node);
    return nodes;
  }, []);

  const selectedNode = nodesByCode.get(selectedCity) ?? nodesByCode.get("DEL") ?? MAP_NODES[0];

  const renderedRoutes = useMemo<RenderedRoute[]>(() => {
    const routes = (data?.edges ?? [])
      .map((edge) => {
        const destination = routeTarget(edge, selectedCity);
        const destinationNode = destination ? nodesByCode.get(destination) : undefined;
        if (!selectedNode || !destination || !destinationNode) return null;
        return {
          key: edge.edge_key,
          origin: selectedCity,
          destination,
          originNode: selectedNode,
          destinationNode,
          forward: directionFor(edge, selectedCity, destination),
          reverse: directionFor(edge, destination, selectedCity),
          fallback: false,
        };
      })
      .filter((route): route is RenderedRoute => route !== null);

    if (routes.length > 0) return routes;

    if (!selectedNode) return [];

    const fallbackRoutes: RenderedRoute[] = [];
    for (const destinationNode of fallbackDestinationNodes(selectedCity, selectedNode, nodesByCode)) {
      fallbackRoutes.push({
        key: `${selectedCity}-${destinationNode.city_code}-fallback`,
        origin: selectedCity,
        destination: destinationNode.city_code,
        originNode: selectedNode,
        destinationNode,
        forward: null,
        reverse: null,
        fallback: true,
      });
    }
    return fallbackRoutes;
  }, [data, nodesByCode, selectedCity, selectedNode]);

  const availableDirections = useMemo(
    () =>
      renderedRoutes.reduce(
        (total, route) => total + Number(route.forward !== null) + Number(route.reverse !== null),
        0
      ),
    [renderedRoutes]
  );

  function selectNode(nodeCode: string) {
    setSelectedCity(nodeCode);
    setTooltip(null);
  }

  return (
    <section className="landing-map" aria-label="Route CPI map">
      <div className="landing-map__media">
        <img
          src="/design-assets/landing-2.png"
          alt=""
          className="landing-map__image"
          draggable={false}
        />
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [82.4, 22.7], scale: 1510 }}
          width={1440}
          height={840}
          className="landing-map__overlay"
        >
          {renderedRoutes.map((route, index) => {
            const cpi = edgeCpi(route.forward, route.reverse);
            return (
              <RouteArc
                key={route.key}
                route={route}
                index={index}
                color={colorForCpi(cpi, route.fallback)}
                strokeWidth={route.fallback ? 1.55 : 2.35}
                strokeOpacity={route.fallback ? 0.42 : 0.86}
                onEnter={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    origin: route.origin,
                    destination: route.destination,
                    forward: route.forward,
                    reverse: route.reverse,
                  })
                }
                onMove={(event) =>
                  setTooltip((current) =>
                    current ? { ...current, x: event.clientX, y: event.clientY } : current
                  )
                }
                onLeave={() => setTooltip(null)}
              />
            );
          })}
          {MAP_NODES.map((node) => {
            const isMajor = MAJOR_CITY_CODES.has(node.city_code);
            const isSelected = node.city_code === selectedCity;
            return (
              <Marker
                key={node.city_code}
                coordinates={[node.longitude, node.latitude]}
                role="button"
                tabIndex={0}
                aria-label={`Show routes from ${node.city_name}`}
                onClick={() => selectNode(node.city_code)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") selectNode(node.city_code);
                }}
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
                <circle
                  r={isSelected ? 8 : isMajor ? 4.5 : 2.8}
                  className={isSelected ? "landing-map__node landing-map__node--active" : "landing-map__node"}
                />
                {isMajor && (
                  <text
                    y={isSelected ? -14 : -8}
                    textAnchor="middle"
                    className="landing-map__label"
                  >
                    {node.city_code}
                  </text>
                )}
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      <div className="landing-map__hud" aria-live="polite">
        <p className="landing-map__eyebrow">Selected node</p>
        <h2>{selectedNode?.city_name ?? selectedCity}</h2>
        <div className="landing-map__stats">
          <span>{loading ? "Loading" : `${renderedRoutes.length} routes`}</span>
          <span>{availableDirections} CPI directions</span>
        </div>
        {error && (
          <p role="alert" className="landing-map__error">
            API unavailable: {error}. Showing preview routes.
          </p>
        )}
      </div>

      {tooltip && (
        <div
          className="landing-map__tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.origin === tooltip.destination ? (
            <>
              <h3>{tooltip.origin}</h3>
              <p>Click to request adjacent route CPI data.</p>
            </>
          ) : (
            <>
              <h3>
                {tooltip.origin} - {tooltip.destination}
              </h3>
              <div className="landing-map__tooltip-grid">
                <DirectionPanel
                  title={`${tooltip.origin} -> ${tooltip.destination}`}
                  direction={tooltip.forward}
                />
                <DirectionPanel
                  title={`${tooltip.destination} -> ${tooltip.origin}`}
                  direction={tooltip.reverse}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
