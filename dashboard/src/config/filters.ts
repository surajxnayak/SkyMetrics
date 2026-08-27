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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultFilters(today = new Date()): Filters {
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 1);

  return {
    frequency: "daily",
    startDate: formatDate(start),
    endDate: formatDate(today),
    trendRoute: "DEL-BOM",
    elasticityRoute: "DEL-BOM",
    selectedRoutes: ROUTES.map((route) => route.id),
    sources: ["akasaair"],
    carrier: "QP",
    advanceWindow: "",
    fareClass: "",
  };
}
