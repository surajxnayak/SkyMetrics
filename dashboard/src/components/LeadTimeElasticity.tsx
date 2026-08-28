import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";
import LoadingSpinner from "./LoadingSpinner";

const WINDOW_ORDER = ["T+45", "T+30", "T+15", "T+7", "T+1"];
const TOOLTIP_STYLE = { backgroundColor: "#1c2025", border: "1px solid #3c494c", borderRadius: 4 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };
// Numeric values (Y-axis ticks, tooltip line values) get the mono font, per
// the design spec's "all numeric data" rule -- text labels (X-axis windows,
// legend series names) stay in the default sans font.
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO_FONT };
const CHART_COLORS = ["#a78bfa", "#4ade80", "#f0b429", "#f87171"];

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type ElasticityPoint = {
  advance_window: string;
  route: string;
  meanFare: number;
};

export type ElasticityChartPoint = Record<string, string | number>;

export interface ElasticityDrilldownFilters {
  carrier: string;
  fareClass: string;
  sources: string[];
}

export function aggregate(records: FareRecord[], drilldown: ElasticityDrilldownFilters): ElasticityPoint[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.sources.length > 0 && !drilldown.sources.includes(record.source)) continue;
    if (drilldown.carrier && record.carrier !== drilldown.carrier) continue;
    if (drilldown.fareClass && record.fare_class !== drilldown.fareClass) continue;
    const route = `${record.origin}-${record.destination}`;
    const key = `${record.advance_window}|${route}`;
    const existing = groups.get(key) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(key, existing);
  }
  const points = Array.from(groups.entries()).map(([key, { sum, count }]) => {
    const [advance_window, route] = key.split("|");
    return { advance_window, route, meanFare: sum / count };
  });
  return points.sort(
    (a, b) =>
      WINDOW_ORDER.indexOf(a.advance_window) - WINDOW_ORDER.indexOf(b.advance_window) ||
      a.route.localeCompare(b.route)
  );
}

export function pivotElasticity(points: ElasticityPoint[]): ElasticityChartPoint[] {
  const rows = new Map<string, ElasticityChartPoint>();
  for (const point of points) {
    const row = rows.get(point.advance_window) ?? { advance_window: point.advance_window };
    row[point.route] = point.meanFare;
    rows.set(point.advance_window, row);
  }
  return WINDOW_ORDER.filter((window) => rows.has(window)).map((window) => rows.get(window)!);
}

export default function LeadTimeElasticity() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <LoadingSpinner label="Loading elasticity data..." center />;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load elasticity data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregate(data, {
    carrier: filters.carrier,
    fareClass: filters.fareClass,
    sources: filters.sources,
  });
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;
  const routes = filters.selectedRoutes.filter((route) => points.some((point) => point.route === route));
  const chartData = pivotElasticity(points);

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-4 text-base font-semibold text-primary">Lead-time elasticity</h2>
      <p className="mb-4 font-mono text-sm text-on-surface-variant">Routes: {routes.join(", ")}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3c494c" />
          <XAxis dataKey="advance_window" stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12 }} />
          <YAxis stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12, fontFamily: MONO_FONT }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          <Legend wrapperStyle={{ color: "#bbc9cd", fontSize: 12 }} />
          {routes.map((route, index) => (
            <Line
              key={route}
              type="monotone"
              dataKey={route}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              name={route}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={points} filename="elasticity.csv" />
      </div>
    </div>
  );
}
