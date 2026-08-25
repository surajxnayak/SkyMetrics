import type { FareRecord, IndexResponse, MetadataResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  const queryString = query.toString();
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!response.ok) {
    throw new ApiError(response.status, `${path} failed with status ${response.status}`);
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
  params: { origin?: string; destination?: string; start?: string; end?: string } = {}
): Promise<FareRecord[]> {
  return get<FareRecord[]>("/api/v1/fares", params);
}

export function getMetadata(): Promise<MetadataResponse> {
  return get<MetadataResponse>("/api/v1/metadata");
}
