import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FareRecord } from "../api/types";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";

const TOOLTIP_STYLE = { backgroundColor: "#12161f", border: "1px solid #1e2530", borderRadius: 6 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };
// Numeric values (Y-axis ticks, tooltip line values) get the mono font, per
// the design spec's "all numeric data" rule -- text labels (X-axis periods,
// legend series names) stay in the default sans font.
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO_FONT };

export type TrendPoint = {
  period: string;
  meanFare: number;
};

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
    const period = periodOf(record.collected_at, frequency);
    const existing = groups.get(period) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(period, existing);
  }
  return Array.from(groups.entries())
    .map(([period, { sum, count }]) => ({ period, meanFare: sum / count }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export default function TrendView() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFares({
    routes: [filters.trendRoute],
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <p className="text-sm text-secondary">Loading trend data...</p>;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load trend data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregateTrend(data, filters.frequency);
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-1 text-base font-semibold text-primary">Trend view</h2>
      <p className="mb-4 font-mono text-sm text-secondary">Route: {filters.trendRoute}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
          <XAxis dataKey="period" stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12, fontFamily: MONO_FONT }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          <Line type="monotone" dataKey="meanFare" stroke="#a78bfa" name="Mean fare" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={points} filename="trend.csv" />
      </div>
    </div>
  );
}
