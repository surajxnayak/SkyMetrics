import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Frequency } from "../api/types";
import { getDefaultFilters } from "../config/filters";

export interface Filters {
  frequency: Frequency;
  startDate: string;
  endDate: string;
  trendRoute: string;
  elasticityRoute: string;
  selectedRoutes: string[];
  sources: string[];
  carrier: string;
  advanceWindow: string;
  fareClass: string;
}

interface FilterContextValue {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  appliedFilters: Filters;
  applyFilters: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => getDefaultFilters());
  const value = useMemo(
    () => ({
      filters,
      setFilters,
      appliedFilters,
      applyFilters: () => setAppliedFilters(filters),
    }),
    [appliedFilters, filters]
  );
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
