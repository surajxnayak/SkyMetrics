import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

const WINDOW_ORDER = ["T+45", "T+30", "T+15", "T+7", "T+1"];
const TOOLTIP_STYLE = { backgroundColor: "#12161f", border: "1px solid #1e2530", borderRadius: 6 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type ElasticityPoint = {
  advance_window: string;
  meanFare: number;
};

export interface ElasticityDrilldownFilters {
  carrier: string;
  fareClass: string;
}

export function aggregate(records: FareRecord[], drilldown: ElasticityDrilldownFilters): ElasticityPoint[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.carrier && record.carrier !== drilldown.carrier) continue;
    if (drilldown.fareClass && record.fare_class !== drilldown.fareClass) continue;
    const existing = groups.get(record.advance_window) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(record.advance_window, existing);
  }
  return WINDOW_ORDER.filter((window) => groups.has(window)).map((window) => {
    const { sum, count } = groups.get(window)!;
    return { advance_window: window, meanFare: sum / count };
  });
}

export default function LeadTimeElasticity() {
  const { filters } = useFilters();
  const { data, loading, error } = useFares({
    origin: filters.origin,
    destination: filters.destination,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading) return <p className="text-sm text-secondary">Loading elasticity data...</p>;
  if (error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load elasticity data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const points = aggregate(data, { carrier: filters.carrier, fareClass: filters.fareClass });
  if (points.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-primary">Lead-time elasticity</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
          <XAxis dataKey="advance_window" stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          <Line type="monotone" dataKey="meanFare" stroke="#a78bfa" name="Mean fare" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={points} filename="elasticity.csv" />
      </div>
    </div>
  );
}
