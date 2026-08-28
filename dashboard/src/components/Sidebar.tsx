import { useEffect, useState } from "react";
import { useFilters, type Filters } from "../context/FilterContext";
import {
  ADVANCE_WINDOWS,
  CARRIERS,
  FARE_CLASSES,
  ROUTES,
  SOURCES,
  TIME_PRESETS,
  datesForTimePreset,
} from "../config/filters";

const LABEL_CLASS =
  "mb-1 mt-3 block font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant first:mt-0";
const INPUT_CLASS =
  "w-full rounded-md border border-outline-variant bg-inset px-3 py-1.5 text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const SELECT_CLASS = INPUT_CLASS + " appearance-none";
const SECTION_CLASS = "mt-5 border-t border-outline-variant pt-5 first:mt-0 first:border-t-0 first:pt-0";
const SECTION_TITLE_CLASS =
  "mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent";

export default function Sidebar() {
  const { filters, setFilters, applyFilters, hasPendingChanges } = useFilters();
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (hasPendingChanges) setSearchFeedback(null);
  }, [hasPendingChanges]);

  function toggleSource(source: string) {
    setFilters((prev) => {
      const selected = prev.sources.includes(source);
      return {
        ...prev,
        sources: selected
          ? prev.sources.filter((item) => item !== source)
          : [...prev.sources, source],
      };
    });
  }

  function toggleRoute(route: string) {
    setFilters((prev) => {
      const selected = prev.selectedRoutes.includes(route);
      if (selected && prev.selectedRoutes.length === 1) return prev;
      return {
        ...prev,
        selectedRoutes: selected
          ? prev.selectedRoutes.filter((item) => item !== route)
          : [...prev.selectedRoutes, route],
      };
    });
  }

  function changeTimePreset(presetId: string) {
    setFilters((prev) => {
      const dates = datesForTimePreset(presetId);
      return {
        ...prev,
        timePreset: presetId,
        ...(dates ?? {}),
      };
    });
  }

  function handleSearch() {
    const changed = applyFilters();
    setSearchFeedback(changed ? "Search sent" : "No filter changes");
  }

  return (
    <aside aria-label="Filters">
      <div className={SECTION_CLASS}>
        <p className={SECTION_TITLE_CLASS}>Time</p>

        <label htmlFor="frequency" className={LABEL_CLASS}>
          Frequency
        </label>
        <select
          id="frequency"
          value={filters.frequency}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, frequency: e.target.value as Filters["frequency"] }))
          }
          className={SELECT_CLASS}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        <label htmlFor="time-preset" className={LABEL_CLASS}>
          Time range
        </label>
        <select
          id="time-preset"
          value={filters.timePreset}
          onChange={(e) => changeTimePreset(e.target.value)}
          className={SELECT_CLASS}
        >
          {TIME_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>

        {filters.timePreset === "custom" && (
          <div className="mt-3 rounded-md border border-outline-variant bg-inset p-3">
            <label
              htmlFor="start-date"
              className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant"
            >
              Start
            </label>
            <input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className={INPUT_CLASS}
            />

            <label
              htmlFor="end-date"
              className="mb-1 mt-3 block font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant"
            >
              End
            </label>
            <input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
        )}
      </div>

      <div className={SECTION_CLASS}>
        <p className={SECTION_TITLE_CLASS}>Coverage</p>

        <fieldset>
          <legend className={LABEL_CLASS}>
            Routes <span className="normal-case text-muted">(3 in the live basket)</span>
          </legend>
          <div className="space-y-2">
            {ROUTES.map((route) => (
              <label key={route.id} className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={filters.selectedRoutes.includes(route.id)}
                  onChange={() => toggleRoute(route.id)}
                  className="h-4 w-4 rounded border-outline-variant bg-inset accent-accent"
                />
                <span>{route.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={LABEL_CLASS}>Source</legend>
          <div className="space-y-2">
            {SOURCES.map((source) => (
              <label key={source.id} className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={filters.sources.includes(source.id)}
                  onChange={() => toggleSource(source.id)}
                  className="h-4 w-4 rounded border-outline-variant bg-inset accent-accent"
                />
                <span>{source.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={SECTION_CLASS}>
        <p className={SECTION_TITLE_CLASS}>Fare filters</p>

        <label htmlFor="carrier" className={LABEL_CLASS}>
          Carrier
        </label>
        <select
          id="carrier"
          value={filters.carrier}
          onChange={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value }))}
          className={SELECT_CLASS}
        >
          <option value="">All carriers</option>
          {CARRIERS.map((carrier) => (
            <option key={carrier.code} value={carrier.code}>
              {carrier.name} ({carrier.code})
            </option>
          ))}
        </select>

        <label htmlFor="advance-window" className={LABEL_CLASS}>
          Advance window
        </label>
        <select
          id="advance-window"
          value={filters.advanceWindow}
          onChange={(e) => setFilters((prev) => ({ ...prev, advanceWindow: e.target.value }))}
          className={SELECT_CLASS}
        >
          <option value="">All</option>
          {ADVANCE_WINDOWS.map((window) => (
            <option key={window} value={window}>
              {window}
            </option>
          ))}
        </select>

        <label htmlFor="fare-class" className={LABEL_CLASS}>
          Fare class
        </label>
        <select
          id="fare-class"
          value={filters.fareClass}
          onChange={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value }))}
          className={SELECT_CLASS}
        >
          <option value="">All fare classes</option>
          {FARE_CLASSES.map((fareClass) => (
            <option key={fareClass} value={fareClass}>
              {fareClass}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleSearch}
        className={
          hasPendingChanges
            ? "mt-6 w-full rounded-md bg-warning px-3 py-2 text-sm font-medium text-page hover:bg-accent-hover"
            : "mt-6 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-page hover:bg-accent-hover"
        }
      >
        {hasPendingChanges ? "Search changes" : searchFeedback === "Search sent" ? "Search sent" : "Search"}
      </button>
      <p className="mt-2 min-h-5 text-sm text-on-surface-variant">
        {searchFeedback ?? (hasPendingChanges ? "Filters changed. Search to refresh." : "Showing current search.")}
      </p>
    </aside>
  );
}
