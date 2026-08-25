import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";

// `type`, not `interface` -- interfaces don't get an implicit index
// signature, which breaks ExportButton's generic constraint.
export type Cell = {
  route: string;
  period: string;
  meanFare: number;
};

export interface DrilldownFilters {
  carrier: string;
  advanceWindow: string;
  fareClass: string;
}

export function aggregate(records: FareRecord[], drilldown: DrilldownFilters): Cell[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.carrier && record.carrier !== drilldown.carrier) continue;
    if (drilldown.advanceWindow && record.advance_window !== drilldown.advanceWindow) continue;
    if (drilldown.fareClass && record.fare_class !== drilldown.fareClass) continue;
    const route = `${record.origin}-${record.destination}`;
    const period = record.collected_at.slice(0, 10);
    const key = `${route}|${period}`;
    const existing = groups.get(key) ?? { sum: 0, count: 0 };
    existing.sum += record.total_fare;
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([key, { sum, count }]) => {
    const [route, period] = key.split("|");
    return { route, period, meanFare: sum / count };
  });
}

function colorFor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(200,200,255)";
  const ratio = (value - min) / (max - min);
  const intensity = Math.round(255 - ratio * 155);
  return `rgb(255,${intensity},${intensity})`;
}

export default function SectorHeatmap() {
  const { filters } = useFilters();
  const { data, loading, error } = useFares({
    origin: filters.origin,
    destination: filters.destination,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading) return <p>Loading heatmap data...</p>;
  if (error) return <p role="alert">Failed to load heatmap data: {error}</p>;
  if (!data || data.length === 0) return <p>No fare data available yet.</p>;

  const cells = aggregate(data, {
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
  });
  if (cells.length === 0) return <p>No non-outlier fare data available yet.</p>;

  const routes = Array.from(new Set(cells.map((cell) => cell.route))).sort();
  const periods = Array.from(new Set(cells.map((cell) => cell.period))).sort();
  const values = cells.map((cell) => cell.meanFare);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cellByKey = new Map(cells.map((cell) => [`${cell.route}|${cell.period}`, cell.meanFare]));

  return (
    <div>
      <h2>Sector heatmap</h2>
      <table>
        <thead>
          <tr>
            <th>Route</th>
            {periods.map((period) => (
              <th key={period}>{period}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route}>
              <th>{route}</th>
              {periods.map((period) => {
                const value = cellByKey.get(`${route}|${period}`);
                return (
                  <td
                    key={period}
                    style={{ backgroundColor: value !== undefined ? colorFor(value, min, max) : undefined }}
                  >
                    {value !== undefined ? Math.round(value) : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ExportButton data={cells} filename="heatmap.csv" />
    </div>
  );
}
