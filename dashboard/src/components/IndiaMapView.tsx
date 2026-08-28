import { useMemo, useRef, useState, type MouseEvent, type MouseEventHandler } from "react";
import { scaleThreshold } from "d3-scale";
import { ComposableMap, Geographies, Geography, Marker, useMapContext } from "react-simple-maps";
import type { Frequency, MapDirection, MapEdge, MapNode } from "../api/types";
import airportCities from "../config/airportCities.json";
import { useMapRoutes } from "../hooks/useMapRoutes";

type CityLabelConfig = {
  label: string;
  dx: number;
  dy: number;
  anchor: "start" | "end";
};

const LABELED_CITY_CONFIG: ReadonlyMap<string, CityLabelConfig> = new Map(
  [
    ["DEL", { label: "Delhi", dx: 22, dy: -6, anchor: "start" }],
    ["BOM", { label: "Mumbai", dx: -16, dy: 4, anchor: "end" }],
    ["BLR", { label: "Bengaluru", dx: -16, dy: 12, anchor: "end" }],
    ["MAA", { label: "Chennai", dx: 16, dy: 8, anchor: "start" }],
    ["HYD", { label: "Hyderabad", dx: 18, dy: 0, anchor: "start" }],
    ["CCU", { label: "Kolkata", dx: 18, dy: -4, anchor: "start" }],
    ["AMD", { label: "Ahmedabad", dx: -14, dy: 2, anchor: "end" }],
    ["PNQ", { label: "Pune", dx: 15, dy: 10, anchor: "start" }],
  ] as const
);

const DISPLAY_CITY_CODES = new Set([
  "DEL",
  "BOM",
  "BLR",
  "MAA",
  "HYD",
  "CCU",
  "AMD",
  "PNQ",
  "GOI",
  "JAI",
  "LKO",
  "GAU",
  "BBI",
  "PAT",
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
];

const FALLBACK_ROUTE_COUNT = 6;
type GeoPoint = [number, number];
type LonLatPoint = [number, number];

type AirportCity = MapNode & {
  primary_airport_name: string;
};

const CPI_COLOR = scaleThreshold<number, string>()
  .domain([98, 102])
  .range(["#6dffb0", "#d7b15f", "#ff7a9b"]);

const REGIONAL_LANDMASSES: { key: string; points: LonLatPoint[] }[] = [
  {
    key: "pakistan-afghanistan",
    points: [
      [60.8, 35.3],
      [66.8, 36.2],
      [73.1, 34.7],
      [75.1, 31.2],
      [73.4, 27.2],
      [69.4, 23.4],
      [64.7, 24.6],
      [60.2, 28.8],
    ],
  },
  {
    key: "himalaya",
    points: [
      [73.9, 36.1],
      [80.1, 34.5],
      [88.4, 30.1],
      [93.1, 28.0],
      [91.6, 25.8],
      [84.6, 26.6],
      [78.8, 29.0],
      [74.0, 32.3],
    ],
  },
  {
    key: "bangladesh-myanmar",
    points: [
      [88.1, 26.5],
      [94.6, 27.6],
      [99.8, 23.1],
      [98.0, 15.6],
      [94.8, 13.9],
      [91.2, 20.8],
      [88.6, 22.0],
    ],
  },
  {
    key: "sri-lanka",
    points: [
      [79.3, 9.8],
      [81.3, 9.4],
      [82.2, 7.1],
      [81.4, 5.7],
      [79.8, 6.1],
      [79.1, 8.0],
    ],
  },
];

const MAP_NODES = airportCities.cities.map((city): AirportCity => ({
  city_code: city.city_code,
  city_name: city.city_name,
  latitude: city.latitude,
  longitude: city.longitude,
  airport_codes: city.airport_codes,
  primary_airport_name: city.airports[0]?.airport_name ?? `${city.city_name} Airport`,
}));

const DISPLAY_NODES = MAP_NODES.filter((node) => DISPLAY_CITY_CODES.has(node.city_code));

type TooltipState =
  | {
      kind: "route";
      x: number;
      y: number;
      origin: string;
      destination: string;
      forward: MapDirection | null;
      reverse: MapDirection | null;
    }
  | {
      kind: "node";
      x: number;
      y: number;
      cityCode: string;
      cityName: string;
      airportName: string;
    }
  | null;

type DragState = {
  origin: string;
  start: GeoPoint;
  current: GeoPoint;
  hasMoved: boolean;
} | null;

type CustomEdge = {
  id: string;
  origin: string;
  destination: string;
};

type RenderedRoute = {
  key: string;
  origin: string;
  destination: string;
  originNode: AirportCity;
  destinationNode: AirportCity;
  forward: MapDirection | null;
  reverse: MapDirection | null;
  fallback: boolean;
  custom?: boolean;
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

function distanceSquared(origin: AirportCity, destination: AirportCity): number {
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
  originNode: AirportCity,
  nodesByCode: Map<string, AirportCity>
): AirportCity[] {
  const preferredNodes = FALLBACK_DESTINATION_CODES.map((code) => nodesByCode.get(code)).filter(
    (node): node is AirportCity => node !== undefined && node.city_code !== origin
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

function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number): GeoPoint {
  const point = svg.createSVGPoint?.();
  const matrix = svg.getScreenCTM?.();

  if (point && matrix) {
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return [transformed.x, transformed.y];
  }

  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return [clientX, clientY];

  return [
    ((clientX - rect.left) / rect.width) * 1440,
    ((clientY - rect.top) / rect.height) * 840,
  ];
}

function svgPointFromMouse(event: MouseEvent<SVGSVGElement>): GeoPoint {
  return svgPointFromClient(event.currentTarget, event.clientX, event.clientY);
}

function draftRoutePath(start: GeoPoint, current: GeoPoint): string {
  const deltaX = current[0] - start[0];
  const deltaY = current[1] - start[1];
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const bend = Math.min(170, Math.max(36, distance * 0.2));
  const controlX = (start[0] + current[0]) / 2;
  const controlY = (start[1] + current[1]) / 2 - bend;
  return `M ${start[0].toFixed(2)} ${start[1].toFixed(2)} Q ${controlX.toFixed(
    2
  )} ${controlY.toFixed(2)} ${current[0].toFixed(2)} ${current[1].toFixed(2)}`;
}

function RegionalBackdrop() {
  const { projection } = useMapContext();

  return (
    <g className="landing-map__regional-layer" aria-hidden="true">
      {REGIONAL_LANDMASSES.map((landmass) => {
        const projectedPoints = landmass.points
          .map((point) => projection(point) as GeoPoint | null)
          .filter((point): point is GeoPoint => point !== null);

        if (projectedPoints.length === 0) return null;

        const pathData = projectedPoints
          .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
          .join(" ");

        return <path key={landmass.key} d={`${pathData} Z`} className="landing-map__regional-land" />;
      })}
    </g>
  );
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
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
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
  const [hasUserSelectedCity, setHasUserSelectedCity] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [customEdges, setCustomEdges] = useState<CustomEdge[]>([]);
  const [dragging, setDragging] = useState<DragState>(null);
  const suppressClickRef = useRef(false);
  const { data, loading, error } = useMapRoutes({
    frequency: "daily" satisfies Frequency,
    originCity: selectedCity,
  });

  const nodesByCode = useMemo(() => {
    const nodes = new Map<string, AirportCity>();
    for (const node of MAP_NODES) nodes.set(node.city_code, node);
    return nodes;
  }, []);

  const selectedNode = nodesByCode.get(selectedCity) ?? nodesByCode.get("DEL") ?? MAP_NODES[0];

  const renderedRoutes = useMemo<RenderedRoute[]>(() => {
    const routes = (data?.edges ?? [])
      .map((edge) => {
        const destination = routeTarget(edge, selectedCity);
        const destinationNode = destination ? nodesByCode.get(destination) : undefined;
        if (
          !selectedNode ||
          !destination ||
          !destinationNode ||
          !DISPLAY_CITY_CODES.has(destination)
        ) {
          return null;
        }
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

  const customRenderedRoutes = useMemo<RenderedRoute[]>(
    () =>
      customEdges
        .flatMap((edge) => {
          const originNode = nodesByCode.get(edge.origin);
          const destinationNode = nodesByCode.get(edge.destination);
          if (!originNode || !destinationNode) return [];

          return [{
            key: edge.id,
            origin: edge.origin,
            destination: edge.destination,
            originNode,
            destinationNode,
            forward: null,
            reverse: null,
            fallback: true,
            custom: true,
          }];
        }),
    [customEdges, nodesByCode]
  );

  const availableDirections = useMemo(
    () =>
      renderedRoutes.reduce(
        (total, route) => total + Number(route.forward !== null) + Number(route.reverse !== null),
        0
      ),
    [renderedRoutes]
  );

  function selectNode(nodeCode: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setHasUserSelectedCity(true);
    setSelectedCity(nodeCode);
    setTooltip(null);
  }

  function startNodeDrag(node: AirportCity, event: MouseEvent<SVGGElement>) {
    if (event.button !== 0) return;
    const svg = event.currentTarget.ownerSVGElement;

    if (!svg) return;

    const start = svgPointFromClient(svg, event.clientX, event.clientY);

    setDragging({
      origin: node.city_code,
      start,
      current: start,
      hasMoved: false,
    });
  }

  function updateNodeDrag(event: MouseEvent<SVGSVGElement>) {
    if (!dragging) return;

    const current = svgPointFromMouse(event);
    const deltaX = current[0] - dragging.start[0];
    const deltaY = current[1] - dragging.start[1];
    const hasMoved = dragging.hasMoved || Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 5;

    if (hasMoved) {
      suppressClickRef.current = true;
      setTooltip(null);
    }

    setDragging({ ...dragging, current, hasMoved });
  }

  function cancelNodeDrag() {
    setDragging(null);
  }

  function completeNodeDrag(destination: string) {
    if (!dragging?.hasMoved || dragging.origin === destination) {
      setDragging(null);
      return;
    }

    const [origin, target] = [dragging.origin, destination].sort();
    const id = `${origin}-${target}-custom`;

    setCustomEdges((current) => {
      if (current.some((edge) => edge.id === id)) return current;
      return [...current, { id, origin: dragging.origin, destination }];
    });
    setDragging(null);
  }

  return (
    <section className="landing-map" aria-label="Route CPI map">
      <div className="landing-map__media">
        <div className="landing-map__ocean" aria-hidden="true" />
        <div className="landing-map__india-pop" aria-hidden="true" />
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [82.8, 22.7], scale: 1390 }}
          width={1440}
          height={840}
          className="landing-map__overlay"
          onMouseMove={updateNodeDrag}
          onMouseUp={cancelNodeDrag}
          onMouseLeave={cancelNodeDrag}
        >
          <RegionalBackdrop />
          <Geographies geography="/maps/india-states-simplified.geojson">
            {({ geographies }) =>
              geographies.map((geography) => (
                <Geography
                  key={geography.rsmKey}
                  geography={geography}
                  className="landing-map__india-state"
                />
              ))
            }
          </Geographies>
          {[...renderedRoutes, ...customRenderedRoutes].map((route, index) => {
            const cpi = edgeCpi(route.forward, route.reverse);
            return (
              <RouteArc
                key={route.key}
                route={route}
                index={index}
                color={route.custom ? "#7fe8ff" : colorForCpi(cpi, route.fallback)}
                strokeWidth={route.custom ? 2.45 : route.fallback ? 1.55 : 2.35}
                strokeOpacity={route.custom ? 0.9 : route.fallback ? 0.42 : 0.86}
                onEnter={(event) =>
                  setTooltip({
                    kind: "route",
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
          {dragging?.hasMoved && (
            <path
              d={draftRoutePath(dragging.start, dragging.current)}
              className="landing-map__route-draft"
            />
          )}
          {DISPLAY_NODES.map((node) => {
            const labelConfig = LABELED_CITY_CONFIG.get(node.city_code);
            const isSelected = hasUserSelectedCity && node.city_code === selectedCity;
            return (
              <Marker
                key={node.city_code}
                className="landing-map__marker"
                coordinates={[node.longitude, node.latitude]}
                role="button"
                tabIndex={0}
                aria-label={`Show routes from ${node.city_name}`}
                onClick={() => selectNode(node.city_code)}
                onMouseDown={(event) => startNodeDrag(node, event)}
                onMouseUp={(event) => {
                  event.stopPropagation();
                  completeNodeDrag(node.city_code);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") selectNode(node.city_code);
                }}
                onMouseEnter={(event) =>
                  setTooltip({
                    kind: "node",
                    x: event.clientX,
                    y: event.clientY,
                    cityCode: node.city_code,
                    cityName: node.city_name,
                    airportName: node.primary_airport_name,
                  })
                }
                onMouseMove={(event) =>
                  setTooltip((current) =>
                    current ? { ...current, x: event.clientX, y: event.clientY } : current
                  )
                }
                onMouseLeave={() => setTooltip(null)}
              >
                <circle r={11} className="landing-map__node-hitarea" />
                <circle
                  r={3.7}
                  className={isSelected ? "landing-map__node landing-map__node--active" : "landing-map__node"}
                />
                {labelConfig && (
                  <text
                    x={labelConfig.dx}
                    y={labelConfig.dy}
                    textAnchor={labelConfig.anchor}
                    className="landing-map__label"
                  >
                    {labelConfig.label}
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
          {tooltip.kind === "node" ? (
            <>
              <h3 className="landing-map__tooltip-title">
                <span className="landing-map__tooltip-plane" aria-hidden="true">
                  &#9992;
                </span>
                {tooltip.cityCode}
              </h3>
              <p>{tooltip.airportName}</p>
              <p className="landing-map__tooltip-city">{tooltip.cityName}</p>
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
