import { useEffect, useState } from "react";
import { getFares } from "../api/client";
import type { FareRecord } from "../api/types";
import { cacheFareData, clearFareDataCache } from "../dataQualityCache";

interface UseFaresResult {
  data: FareRecord[] | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_LIST: string[] = [];

export function useFares(
  params: {
    routes?: string[];
    origin?: string;
    destination?: string;
    sources?: string[];
    carrier?: string;
    advanceWindow?: string;
    fareClass?: string;
    start?: string;
    end?: string;
  } = {}
): UseFaresResult {
  const [data, setData] = useState<FareRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    routes = EMPTY_LIST,
    origin,
    destination,
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
    clearFareDataCache();
    getFares({
      routes: routes.length > 0 ? routes : undefined,
      origin: origin || undefined,
      destination: destination || undefined,
      sources: sources.length > 0 ? sources : undefined,
      carrier: carrier || undefined,
      advanceWindow: advanceWindow || undefined,
      fareClass: fareClass || undefined,
      start: start || undefined,
      end: end || undefined,
    })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          cacheFareData(result);
          window.dispatchEvent(new Event("skymetrics:data-received"));
          window.dispatchEvent(new Event("skymetrics:fare-data-received"));
        }
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
  }, [routes, origin, destination, sources, carrier, advanceWindow, fareClass, start, end]);

  return { data, loading, error };
}
