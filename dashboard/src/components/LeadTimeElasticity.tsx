import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

const WINDOW_ORDER = ["T+45", "T+30", "T+15", "T+7", "T+1"];

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type ElasticityPoint = {
  advance_window: string;
  meanFare: number;
};

export interface DrilldownFilters {
  carrier: string;
  fareClass: string;
}

export function aggregate(records: FareRecord[], drilldown: DrilldownFilters): ElasticityPoint[] {
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

  if (loading) return <p>Loading elasticity data...</p>;
  if (error) return <p role="alert">Failed to load elasticity data: {error}</p>;
  if (!data || data.length === 0) return <p>No fare data available yet.</p>;

  const points = aggregate(data, { carrier: filters.carrier, fareClass: filters.fareClass });
  if (points.length === 0) return <p>No non-outlier fare data available yet.</p>;

  return (
    <div>
      <h2>Lead-time elasticity</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="advance_window" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="meanFare" stroke="#8884d8" name="Mean fare" />
        </LineChart>
      </ResponsiveContainer>
      <ExportButton data={points} filename="elasticity.csv" />
    </div>
  );
}
