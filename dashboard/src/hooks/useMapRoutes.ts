import { useEffect, useState } from "react";
import { getMapRoutes } from "../api/client";
import type { MapRoutesResponse } from "../api/types";

interface UseMapRoutesResult {
  data: MapRoutesResponse | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_ROUTES: string[] = [];

export function useMapRoutes(params: {
  frequency: string;
  routes?: string[];
  period?: string;
  snapshotId?: string;
}): UseMapRoutesResult {
  const [data, setData] = useState<MapRoutesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { frequency, routes = EMPTY_ROUTES, period, snapshotId } = params;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMapRoutes({
      frequency,
      routes: routes.length > 0 ? routes : undefined,
      period: period || undefined,
      snapshotId: snapshotId || undefined,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [frequency, routes, period, snapshotId]);

  return { data, loading, error };
}
