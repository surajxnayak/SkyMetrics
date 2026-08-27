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
  timePreset: string;
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
  hasPendingChanges: boolean;
  applyFilters: () => boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => getDefaultFilters());
  const hasPendingChanges = JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const value = useMemo(
    () => ({
      filters,
      setFilters,
      appliedFilters,
      hasPendingChanges,
      applyFilters: () => {
        if (!hasPendingChanges) return false;
        setAppliedFilters(filters);
        return true;
      },
    }),
    [appliedFilters, filters, hasPendingChanges]
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
