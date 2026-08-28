import { useEffect, useState } from "react";
import { getFareRecords } from "../api/client";
import type { FareRecordsResponse } from "../api/types";

interface UseFareRecordsResult {
  data: FareRecordsResponse | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_LIST: string[] = [];

export function useFareRecords(
  params: {
    routes?: string[];
    sources?: string[];
    carrier?: string;
    advanceWindow?: string;
    fareClass?: string;
    start?: string;
    end?: string;
  } = {}
): UseFareRecordsResult {
  const [data, setData] = useState<FareRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    routes = EMPTY_LIST,
    sources = EMPTY_LIST,
    carrier,
    advanceWindow,
    fareClass,
    start,
    end,
  } = params;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    getFareRecords({
      routes: routes.length > 0 ? routes : undefined,
      sources: sources.length > 0 ? sources : undefined,
      carrier: carrier || undefined,
      advanceWindow: advanceWindow || undefined,
      fareClass: fareClass || undefined,
      start: start || undefined,
      end: end || undefined,
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
  }, [routes, sources, carrier, advanceWindow, fareClass, start, end]);

  return { data, loading, error };
}
