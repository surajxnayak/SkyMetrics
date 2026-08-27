import type { Filters } from "../context/FilterContext";

export const LOCATIONS = [
  { code: "DEL", name: "Delhi" },
  { code: "BOM", name: "Mumbai" },
  { code: "BLR", name: "Bengaluru" },
] as const;

export const ROUTES = [
  { id: "DEL-BOM", origin: "DEL", destination: "BOM", label: "Delhi (DEL) - Mumbai (BOM)" },
  { id: "DEL-BLR", origin: "DEL", destination: "BLR", label: "Delhi (DEL) - Bengaluru (BLR)" },
  { id: "BOM-BLR", origin: "BOM", destination: "BLR", label: "Mumbai (BOM) - Bengaluru (BLR)" },
] as const;

export const SOURCES = [
  { id: "akasaair", label: "Akasa Air" },
] as const;

export const CARRIERS = [
  { code: "QP", name: "Akasa Air" },
] as const;

export const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"] as const;

export const TIME_PRESETS = [
  { id: "last_1_month", label: "Last month", months: 1 },
  { id: "last_3_months", label: "Last 3 months", months: 3 },
  { id: "last_6_months", label: "Last 6 months", months: 6 },
  { id: "last_1_year", label: "Last year", months: 12 },
  { id: "last_2_years", label: "Last 2 years", months: 24 },
  { id: "custom", label: "Custom", months: null },
] as const;

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function datesForTimePreset(presetId: string, today = new Date()) {
  const preset = TIME_PRESETS.find((item) => item.id === presetId);
  if (!preset || preset.months === null) return null;
  const start = new Date(today);
  start.setMonth(start.getMonth() - preset.months);
  return {
    startDate: formatDate(start),
    endDate: formatDate(today),
  };
}

export function getDefaultFilters(today = new Date()): Filters {
  const timePreset = "last_1_year";
  const dates = datesForTimePreset(timePreset, today)!;

  return {
    frequency: "daily",
    startDate: dates.startDate,
    endDate: dates.endDate,
    timePreset,
    selectedRoutes: ROUTES.map((route) => route.id),
    sources: ["akasaair"],
    carrier: "QP",
    advanceWindow: "",
    fareClass: "",
  };
}
