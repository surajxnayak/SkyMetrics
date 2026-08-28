import { useFares } from "../hooks/useFares";
import { useMetadata } from "../hooks/useMetadata";
import type { FareRecord } from "../api/types";
import { useFilters } from "../context/FilterContext";
import { ADVANCE_WINDOWS } from "../config/filters";
import AnalyticsLoadingSkeleton from "./AnalyticsLoadingSkeleton";

export interface DataQualityStats {
  coveragePercent: number;
  outlierPercent: number;
  availableCount: number;
  noFlightCount: number;
}

export function computeStats(records: FareRecord[], routes: string[]): DataQualityStats {
  const expected = new Set<string>();
  for (const route of routes) {
    for (const window of ADVANCE_WINDOWS) {
      expected.add(`${route}|${window}`);
    }
  }

  const seen = new Set<string>();
  let outlierCount = 0;
  let availableCount = 0;
  let noFlightCount = 0;
  for (const record of records) {
    const route = `${record.origin}-${record.destination}`;
    seen.add(`${route}|${record.advance_window}`);
    if (record.is_outlier) outlierCount += 1;
    if (record.status === "available") availableCount += 1;
    if (record.status === "no_flight") noFlightCount += 1;
  }

  let coveredCount = 0;
  for (const key of expected) {
    if (seen.has(key)) coveredCount += 1;
  }

  return {
    coveragePercent: expected.size === 0 ? 0 : (coveredCount / expected.size) * 100,
    outlierPercent: records.length === 0 ? 0 : (outlierCount / records.length) * 100,
    availableCount,
    noFlightCount,
  };
}

export default function DataQualityPanel() {
  const { appliedFilters: filters } = useFilters();
  const fares = useFares({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });
  const metadata = useMetadata();

  if ((fares.loading && !fares.data) || metadata.loading) {
    return <AnalyticsLoadingSkeleton title="data quality" variant="quality" />;
  }
  if (fares.error && !fares.data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load data quality: {fares.error}
    </p>
  );
  if (metadata.error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load data quality: {metadata.error}
    </p>
  );
  if (!metadata.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;
  if (!fares.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;

  const routes = filters.selectedRoutes.length > 0
    ? filters.selectedRoutes
    : Object.keys(metadata.data.weights.weights);
  const stats = computeStats(fares.data, routes);

  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-secondary">Data quality</h3>
      {fares.error && (
        <p role="alert" className="mb-2 text-sm text-error">
          Search failed: {fares.error}
        </p>
      )}
      <p className="mb-1 text-sm text-primary">
        Coverage: <span className="font-mono text-accent">{stats.coveragePercent.toFixed(0)}%</span>
      </p>
      <p className="mb-1 text-sm text-primary">
        Outliers flagged: <span className="font-mono text-accent">{stats.outlierPercent.toFixed(1)}%</span>
      </p>
      <p className="text-sm text-primary">
        Source health:{" "}
        <span className="font-mono">
          {stats.availableCount} available / {stats.noFlightCount} no-flight
        </span>
      </p>
    </div>
  );
}
