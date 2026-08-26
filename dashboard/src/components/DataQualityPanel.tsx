import { useFares } from "../hooks/useFares";
import { useMetadata } from "../hooks/useMetadata";
import type { FareRecord } from "../api/types";

const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"];

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
  const fares = useFares();
  const metadata = useMetadata();

  if (fares.loading || metadata.loading) return <p className="text-sm text-secondary">Loading data quality...</p>;
  if (fares.error) return (
    <p role="alert" className="text-sm text-down">
      Failed to load data quality: {fares.error}
    </p>
  );
  if (metadata.error) return (
    <p role="alert" className="text-sm text-down">
      Failed to load data quality: {metadata.error}
    </p>
  );
  if (!metadata.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;
  if (!fares.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;

  const routes = Object.keys(metadata.data.weights.weights);
  const stats = computeStats(fares.data, routes);

  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-secondary">Data quality</h3>
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
