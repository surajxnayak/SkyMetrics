import { createContext, useContext, useState, type ReactNode } from "react";
import type { Frequency } from "../api/types";

export interface Filters {
  frequency: Frequency;
  startDate: string;
  endDate: string;
  origin: string;
  destination: string;
  carrier: string;
  advanceWindow: string;
  fareClass: string;
}

export const DEFAULT_FILTERS: Filters = {
  frequency: "daily",
  startDate: "",
  endDate: "",
  origin: "",
  destination: "",
  carrier: "",
  advanceWindow: "",
  fareClass: "",
};

interface FilterContextValue {
  filters: Filters;
  setFilters: (filters: Filters) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  return <FilterContext.Provider value={{ filters, setFilters }}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
