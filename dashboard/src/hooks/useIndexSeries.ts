import { useEffect, useState } from "react";
import { getIndex } from "../api/client";
import type { IndexResponse } from "../api/types";

interface UseIndexSeriesResult {
  data: IndexResponse | null;
  loading: boolean;
  error: string | null;
}

export function useIndexSeries(frequency: string, start: string, end: string): UseIndexSeriesResult {
  const [data, setData] = useState<IndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getIndex({ frequency, start: start || undefined, end: end || undefined })
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
  }, [frequency, start, end]);

  return { data, loading, error };
}
