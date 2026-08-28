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

// Real sources with fare data in fare_quotes -- one live scrape, two
// historical public datasets used to seed the pipeline before Akasa's
// first live run (see README's data-sources section).
export const SOURCES = [
  { id: "akasaair", label: "Akasa Air (live)" },
  { id: "historical_public_airfare_2022", label: "Historical public airfare (2022)" },
  { id: "goibibo_historical_2023", label: "Goibibo historical (2023)" },
] as const;

// Real carrier codes present in fare_quotes -- QP is the only one from the
// live Akasa scrape; the rest come from the historical datasets above.
export const CARRIERS = [
  { code: "QP", name: "Akasa Air" },
  { code: "6E", name: "IndiGo" },
  { code: "AI", name: "Air India" },
  { code: "UK", name: "Vistara" },
  { code: "SG", name: "SpiceJet" },
  { code: "G8", name: "Go First" },
  { code: "I5", name: "AirAsia India" },
] as const;

// The real, distinct fare_class values in fare_quotes today.
export const FARE_CLASSES = [
  "business", "economy",
  "O3", "O4", "P0", "P1", "P2", "P3", "P4",
  "Q0", "Q1", "Q2", "Q3", "Q4",
  "R0", "R1", "R2", "R3", "R4",
  "T0", "T1", "T2", "T3", "T4",
  "U0", "U1", "U2", "U3", "V0",
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
