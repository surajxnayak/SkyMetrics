import { useFilters } from "../context/FilterContext";
import { useFares } from "../hooks/useFares";
import ExportButton from "./ExportButton";
import type { FareRecord } from "../api/types";
import AnalyticsLoadingSkeleton from "./AnalyticsLoadingSkeleton";

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
  sources: string[];
}

export function aggregate(records: FareRecord[], drilldown: DrilldownFilters): Cell[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    if (record.status !== "available" || record.is_outlier || record.total_fare === null) continue;
    if (drilldown.sources.length > 0 && !drilldown.sources.includes(record.source)) continue;
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
  if (max === min) return "hsl(142, 72%, 32%)";
  const ratio = (value - min) / (max - min);
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  // Keep the heatmap binary: lower values are green and higher values red.
  // Vary lightness within each family without introducing yellow cells.
  const isHigh = clampedRatio >= 0.5;
  const familyRatio = isHigh ? (clampedRatio - 0.5) * 2 : clampedRatio * 2;
  const lightness = Math.round(28 + familyRatio * 9);
  return `hsl(${isHigh ? 0 : 142}, 72%, ${lightness}%)`;
}

export default function SectorHeatmap() {
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

  if (loading && !data) return <AnalyticsLoadingSkeleton title="Sector heatmap" variant="table" />;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load heatmap data: {error}
    </p>
  );
  if (!data || data.length === 0) return <p className="text-sm text-secondary">No fare data available yet.</p>;

  const cells = aggregate(data, {
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    sources: filters.sources,
  });
  if (cells.length === 0) return <p className="text-sm text-secondary">No non-outlier fare data available yet.</p>;

  const routes = Array.from(new Set(cells.map((cell) => cell.route))).sort();
  const periods = Array.from(new Set(cells.map((cell) => cell.period))).sort();
  const values = cells.map((cell) => cell.meanFare);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cellByKey = new Map(cells.map((cell) => [`${cell.route}|${cell.period}`, cell.meanFare]));

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <h2 className="mb-4 text-base font-semibold text-primary">Sector heatmap</h2>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-outline-variant bg-panel px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">
                Route
              </th>
              {periods.map((period) => (
                <th
                  key={period}
                  className="border border-outline-variant bg-panel px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-on-surface-variant"
                >
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route}>
                <th className="border border-outline-variant bg-panel px-3 py-2 text-left font-medium text-primary">
                  {route}
                </th>
                {periods.map((period) => {
                  const value = cellByKey.get(`${route}|${period}`);
                  return (
                    <td
                      key={period}
                      className="border border-outline-variant px-3 py-2 text-right font-mono text-primary"
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
      </div>
      <div className="mt-4">
        <ExportButton data={cells} filename="heatmap.csv" />
      </div>
    </div>
  );
}
