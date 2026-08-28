import { ComposableMap, Geographies, Geography, Line, Marker } from "react-simple-maps";
import airportCitiesConfig from "../config/airportCities.json";

const GEO_URL = "/maps/india-states-simplified.geojson";

interface AirportCity {
  city_code: string;
  city_name: string;
  latitude: number;
  longitude: number;
}

const HUB_CODE = "DEL";

// Purely a brand/atmosphere visual, not a data claim -- every line just
// radiates from the hub to a real city coordinate, uniformly styled (no
// CPI colour-coding, no numeric labels). The real, interactive, data-driven
// map lives in MapView.tsx inside the dashboard.
const SPOKE_CODES = [
  "JAI", "LKO", "PAT", "GAU", "AMD", "IDR", "BHO", "NAG", "RPR", "CCU",
  "BBI", "BOM", "PNQ", "HYD", "VTZ", "GOI", "BLR", "MAA", "COK", "IXM", "TRV",
];

const LABELED_CODES = new Set(["AMD", "BOM", "PNQ", "CCU", "HYD", "GOI", "BLR", "MAA", "COK", "TRV"]);

const CITY_BY_CODE = new Map(
  (airportCitiesConfig as { cities: AirportCity[] }).cities.map((city) => [city.city_code, city])
);

const HUB = CITY_BY_CODE.get(HUB_CODE)!;
const SPOKES = SPOKE_CODES.map((code) => CITY_BY_CODE.get(code)!).filter(Boolean);

export default function HeroMap() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [82.8, 23.2], scale: 1500 }}
        width={1000}
        height={1000}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="var(--color-surface-container)"
                stroke="var(--color-accent-muted)"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {SPOKES.map((city) => (
          <Line
            key={city.city_code}
            from={[HUB.longitude, HUB.latitude]}
            to={[city.longitude, city.latitude]}
            className="hero-spoke"
            stroke="var(--color-accent)"
            strokeWidth={0.7}
            strokeOpacity={0.45}
          />
        ))}

        {SPOKES.map((city) => (
          <Marker key={city.city_code} coordinates={[city.longitude, city.latitude]}>
            <circle r={2.2} fill="var(--color-accent-hover)" className="hero-node" />
            {LABELED_CODES.has(city.city_code) && (
              <text
                textAnchor="middle"
                y={-8}
                className="select-none fill-secondary font-mono text-[8px] uppercase tracking-wide"
              >
                {city.city_name}
              </text>
            )}
          </Marker>
        ))}

        <Marker coordinates={[HUB.longitude, HUB.latitude]}>
          <circle r={5} fill="var(--color-accent)" className="hero-hub" />
          <text
            textAnchor="middle"
            y={-12}
            className="select-none fill-primary font-mono text-[9px] font-semibold uppercase tracking-wide"
          >
            {HUB.city_name}
          </text>
        </Marker>
      </ComposableMap>
    </div>
  );
}
