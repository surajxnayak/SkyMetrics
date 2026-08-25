import { useEffect, useState } from "react";
import { getFares } from "../api/client";
import type { FareRecord } from "../api/types";

interface UseFaresResult {
  data: FareRecord[] | null;
  loading: boolean;
  error: string | null;
}

export function useFares(
  params: { origin?: string; destination?: string; start?: string; end?: string } = {}
): UseFaresResult {
  const [data, setData] = useState<FareRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { origin, destination, start, end } = params;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFares({
      origin: origin || undefined,
      destination: destination || undefined,
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
  }, [origin, destination, start, end]);

  return { data, loading, error };
}
