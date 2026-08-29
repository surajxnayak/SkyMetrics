import type { FareRecord } from "./api/types";

let cachedFareData: FareRecord[] | null = null;

export function cacheFareData(records: FareRecord[]): void {
  cachedFareData = records;
}

export function clearFareDataCache(): void {
  cachedFareData = null;
}

export function getCachedFareData(): FareRecord[] | null {
  return cachedFareData;
}
