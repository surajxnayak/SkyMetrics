import { useEffect, useState } from "react";
import { getCachedFareData } from "../dataQualityCache";
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
  const [cachedRecords, setCachedRecords] = useState(getCachedFareData);
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
  useEffect(() => {
    const updateCache = () => setCachedRecords(getCachedFareData());
    window.addEventListener("skymetrics:fare-data-received", updateCache);
    return () => window.removeEventListener("skymetrics:fare-data-received", updateCache);
  }, []);

  const records = cachedRecords ?? fares.data;
  const needsMetadata = filters.selectedRoutes.length === 0;

  if ((fares.loading && !records) || (needsMetadata && metadata.loading)) {
    return <AnalyticsLoadingSkeleton title="data quality" variant="quality" />;
  }
  if (fares.error && !records) return (
    <p role="alert" className="text-sm text-error">
      Failed to load data quality: {fares.error}
    </p>
  );
  if (needsMetadata && metadata.error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load data quality: {metadata.error}
    </p>
  );
  if (needsMetadata && !metadata.data) return <p className="text-sm text-secondary">No data quality information available yet.</p>;
  if (!records) return <p className="text-sm text-secondary">No data quality information available yet.</p>;

  const routes = filters.selectedRoutes.length > 0
    ? filters.selectedRoutes
    : Object.keys(metadata.data?.weights.weights ?? {});
  const stats = computeStats(records, routes);

  return (
    <div>
      <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
        Data quality
      </h3>
      {fares.error && (
        <p role="alert" className="mb-2 text-sm text-error">
          Search failed: {fares.error}
        </p>
      )}
      <div className="flex flex-col gap-1.5 rounded-sm border border-outline-variant bg-surface-container-low p-3">
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Coverage:</span>
          <span className="font-mono text-accent">{stats.coveragePercent.toFixed(0)}%</span>
        </p>
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Outliers flagged:</span>
          <span className="font-mono text-accent">{stats.outlierPercent.toFixed(1)}%</span>
        </p>
        <p className="flex items-center justify-between text-sm text-primary">
          <span>Source health:</span>
          <span className="font-mono">
            {stats.availableCount} available / {stats.noFlightCount} no-flight
          </span>
        </p>
      </div>
    </div>
  );
}
