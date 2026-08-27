import { useFilters, type Filters } from "../context/FilterContext";
import { ADVANCE_WINDOWS, CARRIERS, ROUTES, SOURCES } from "../config/filters";

const LABEL_CLASS = "mb-1 mt-4 block text-xs font-medium uppercase tracking-wide text-secondary first:mt-0";
const INPUT_CLASS =
  "w-full rounded-md border border-line bg-inset px-3 py-1.5 text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const SELECT_CLASS = INPUT_CLASS + " appearance-none";

export default function Sidebar() {
  const { filters, setFilters, applyFilters } = useFilters();

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
      return {
        ...prev,
        selectedRoutes: selected
          ? prev.selectedRoutes.filter((item) => item !== route)
          : [...prev.selectedRoutes, route],
      };
    });
  }

  return (
    <aside>
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

      <label htmlFor="start-date" className={LABEL_CLASS}>
        Start
      </label>
      <input
        id="start-date"
        type="date"
        value={filters.startDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="end-date" className={LABEL_CLASS}>
        End
      </label>
      <input
        id="end-date"
        type="date"
        value={filters.endDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="trend-route" className={LABEL_CLASS}>
        Trend route
      </label>
      <select
        id="trend-route"
        value={filters.trendRoute}
        onChange={(e) => setFilters((prev) => ({ ...prev, trendRoute: e.target.value }))}
        className={SELECT_CLASS}
      >
        {ROUTES.map((route) => (
          <option key={route.id} value={route.id}>
            {route.label}
          </option>
        ))}
      </select>

      <label htmlFor="elasticity-route" className={LABEL_CLASS}>
        Elasticity route
      </label>
      <select
        id="elasticity-route"
        value={filters.elasticityRoute}
        onChange={(e) => setFilters((prev) => ({ ...prev, elasticityRoute: e.target.value }))}
        className={SELECT_CLASS}
      >
        {ROUTES.map((route) => (
          <option key={route.id} value={route.id}>
            {route.label}
          </option>
        ))}
      </select>

      <fieldset>
        <legend className={LABEL_CLASS}>Heatmap/List routes</legend>
        <div className="space-y-2">
          {ROUTES.map((route) => (
            <label key={route.id} className="flex items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={filters.selectedRoutes.includes(route.id)}
                onChange={() => toggleRoute(route.id)}
                className="h-4 w-4 rounded border-line bg-inset accent-accent"
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
                className="h-4 w-4 rounded border-line bg-inset accent-accent"
              />
              <span>{source.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="carrier" className={LABEL_CLASS}>
        Carrier
      </label>
      <select
        id="carrier"
        value={filters.carrier}
        onChange={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value }))}
        className={SELECT_CLASS}
      >
        <option value="">All</option>
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
      <input
        id="fare-class"
        value={filters.fareClass}
        onChange={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <button
        type="button"
        onClick={applyFilters}
        className="mt-6 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-page hover:bg-accent-hover"
      >
        Search
      </button>
    </aside>
  );
}
