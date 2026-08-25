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

  if (fares.loading || metadata.loading) return <p>Loading data quality...</p>;
  if (fares.error) return <p role="alert">Failed to load data quality: {fares.error}</p>;
  if (metadata.error) return <p role="alert">Failed to load data quality: {metadata.error}</p>;
  if (!fares.data || !metadata.data) return <p>No data quality information available yet.</p>;

  const routes = Object.keys(metadata.data.weights.weights);
  const stats = computeStats(fares.data, routes);

  return (
    <div>
      <h3>Data quality</h3>
      <p>Coverage: {stats.coveragePercent.toFixed(0)}%</p>
      <p>Outliers flagged: {stats.outlierPercent.toFixed(1)}%</p>
      <p>
        Source health: {stats.availableCount} available / {stats.noFlightCount} no-flight
      </p>
    </div>
  );
}
