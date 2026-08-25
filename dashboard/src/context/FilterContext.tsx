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
  setFilters: Dispatch<SetStateAction<Filters>>;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const value = useMemo(() => ({ filters, setFilters }), [filters]);
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
