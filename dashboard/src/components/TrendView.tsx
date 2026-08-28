import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FareRecord } from "../api/types";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import LoadingSpinner from "./LoadingSpinner";

const TOOLTIP_STYLE = { backgroundColor: "#1c2025", border: "1px solid #3c494c", borderRadius: 4 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };
// Numeric values (Y-axis ticks, tooltip line values) get the mono font, per
// the design spec's "all numeric data" rule -- text labels (X-axis periods,
// legend series names) stay in the default sans font.
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO_FONT };
const CHART_COLORS = ["#a78bfa", "#4ade80", "#f0b429", "#f87171"];

export type TrendPoint = {
  period: string;
  route: string;
  meanFare: number;
};

export type TrendChartPoint = Record<string, string | number>;

function isoWeekOf(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodOf(value: string, frequency: string): string {
  const date = new Date(value);
  if (frequency === "weekly") return isoWeekOf(date);
  if (frequency === "monthly") return value.slice(0, 7);
  return value.slice(0, 10);
}

export function aggregateTrend(records: FareRecord[], frequency: string): TrendPoint[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    const route = `${record.origin}-${record.destination}`;
    const period = periodOf(record.collected_at, frequency);
    const key = `${period}|${route}`;
    const existing = groups.get(key) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.entries())
    .map(([key, { sum, count }]) => {
      const [period, route] = key.split("|");
      return { period, route, meanFare: sum / count };
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.route.localeCompare(b.route));
}

export function pivotTrend(points: TrendPoint[], routes: string[]): TrendChartPoint[] {
  const rows = new Map<string, TrendChartPoint>();
  for (const point of points) {
    const row = rows.get(point.period) ?? { period: point.period };
    row[point.route] = point.meanFare;
    rows.set(point.period, row);
  }
  return Array.from(rows.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

function formatFare(value: unknown): string {
  if (typeof value !== "number") return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function TrendView() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <LoadingSpinner label="Loading trend data..." center />;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load trend data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregateTrend(data, filters.frequency);
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;
  const routes = filters.selectedRoutes.filter((route) => points.some((point) => point.route === route));
  const chartData = pivotTrend(points, routes);
  const latestRow = chartData[chartData.length - 1];

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-1 text-base font-semibold text-primary">Trend view</h2>
      <p className="mb-4 font-mono text-sm text-on-surface-variant">Routes: {routes.join(", ")}</p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {routes.map((route) => (
          <div key={route} className="rounded-sm border border-outline-variant bg-panel p-2">
            <p className="font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">{route}</p>
            <p className="font-mono text-lg font-semibold text-primary">{formatFare(latestRow?.[route])}</p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3c494c" />
          <XAxis dataKey="period" stroke="#bbc9cd" tick={{ fill: "#bbc9cd", fontSize: 12 }} />
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
        <ExportButton data={points} filename="trend.csv" />
      </div>
    </div>
  );
}
