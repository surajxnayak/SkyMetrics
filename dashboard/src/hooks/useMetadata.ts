import { useEffect, useState } from "react";
import { getMetadata } from "../api/client";
import type { MetadataResponse } from "../api/types";

interface UseMetadataResult {
  data: MetadataResponse | null;
  loading: boolean;
  error: string | null;
}

export function useMetadata(): UseMetadataResult {
  const [data, setData] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMetadata()
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
  }, []);

  return { data, loading, error };
}
