import type {
  FareRecord,
  FareRecordsResponse,
  IndexResponse,
  MapRoutesResponse,
  MetadataResponse,
} from "./types";

const CONFIGURED_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_DEV_PROXY =
  import.meta.env.DEV &&
  /^https?:\/\/(127\.0\.0\.1|localhost):8000\/?$/.test(CONFIGURED_BASE_URL);
const BASE_URL = USE_DEV_PROXY ? "" : CONFIGURED_BASE_URL.replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type QueryValue = string | string[] | undefined;

async function get<T>(path: string, params: Record<string, QueryValue> = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const queryString = query.toString();
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!response.ok) {
    let message = `${path} failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Fall back to the generic status message when the response is not JSON.
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export function getIndex(params: {
  frequency: string;
  comparisonId?: string;
  start?: string;
  end?: string;
}): Promise<IndexResponse> {
  return get<IndexResponse>("/api/v1/index", {
    frequency: params.frequency,
    comparison_id: params.comparisonId,
    start: params.start,
    end: params.end,
  });
}

export function getFares(
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
): Promise<FareRecord[]> {
  return get<FareRecord[]>("/api/v1/fares", {
    route: params.routes,
    origin: params.origin,
    destination: params.destination,
    source: params.sources,
    carrier: params.carrier,
    advance_window: params.advanceWindow,
    fare_class: params.fareClass,
    start: params.start,
    end: params.end,
  });
}

export function getFareRecords(
  params: {
    routes?: string[];
    sources?: string[];
    carrier?: string;
    advanceWindow?: string;
    fareClass?: string;
    start?: string;
    end?: string;
  } = {}
): Promise<FareRecordsResponse> {
  return get<FareRecordsResponse>("/api/v1/fare-records", {
    route: params.routes,
    source: params.sources,
    carrier: params.carrier,
    advance_window: params.advanceWindow,
    fare_class: params.fareClass,
    start: params.start,
    end: params.end,
  });
}

export function getMetadata(): Promise<MetadataResponse> {
  return get<MetadataResponse>("/api/v1/metadata");
}

export function getMapRoutes(
  params: {
    frequency: string;
    routes?: string[];
    originCity?: string;
    period?: string;
    snapshotId?: string;
  }
): Promise<MapRoutesResponse> {
  return get<MapRoutesResponse>("/api/v1/map/routes", {
    frequency: params.frequency,
    route: params.routes,
    origin_city: params.originCity,
    period: params.period,
    snapshot_id: params.snapshotId,
  });
}
