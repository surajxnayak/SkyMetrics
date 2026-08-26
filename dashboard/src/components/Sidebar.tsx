import { useFilters, type Filters } from "../context/FilterContext";

const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"];

const LABEL_CLASS = "mb-1 mt-4 block text-xs font-medium uppercase tracking-wide text-secondary first:mt-0";
const INPUT_CLASS =
  "w-full rounded-md border border-line bg-inset px-3 py-1.5 text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";

export default function Sidebar() {
  const { filters, setFilters } = useFilters();

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
        className={INPUT_CLASS}
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
        value={filters.startDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="end-date" className={LABEL_CLASS}>
        End
      </label>
      <input
        id="end-date"
        value={filters.endDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="origin" className={LABEL_CLASS}>
        Origin
      </label>
      <input
        id="origin"
        value={filters.origin}
        onChange={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="destination" className={LABEL_CLASS}>
        Destination
      </label>
      <input
        id="destination"
        value={filters.destination}
        onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="carrier" className={LABEL_CLASS}>
        Carrier
      </label>
      <input
        id="carrier"
        value={filters.carrier}
        onChange={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      <label htmlFor="advance-window" className={LABEL_CLASS}>
        Advance window
      </label>
      <select
        id="advance-window"
        value={filters.advanceWindow}
        onChange={(e) => setFilters((prev) => ({ ...prev, advanceWindow: e.target.value }))}
        className={INPUT_CLASS}
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
    </aside>
  );
}
