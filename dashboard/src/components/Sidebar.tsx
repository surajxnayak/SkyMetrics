import { useFilters, type Filters } from "../context/FilterContext";

const ADVANCE_WINDOWS = ["T+1", "T+7", "T+15", "T+30", "T+45"];

export default function Sidebar() {
  const { filters, setFilters } = useFilters();

  return (
    <aside>
      <label htmlFor="frequency">Frequency</label>
      <select
        id="frequency"
        value={filters.frequency}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, frequency: e.target.value as Filters["frequency"] }))
        }
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>

      <label htmlFor="start-date">Start</label>
      <input
        id="start-date"
        value={filters.startDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
      />

      <label htmlFor="end-date">End</label>
      <input
        id="end-date"
        value={filters.endDate}
        onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
      />

      <label htmlFor="origin">Origin</label>
      <input
        id="origin"
        value={filters.origin}
        onChange={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value.toUpperCase() }))}
      />

      <label htmlFor="destination">Destination</label>
      <input
        id="destination"
        value={filters.destination}
        onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value.toUpperCase() }))}
      />

      <label htmlFor="carrier">Carrier</label>
      <input
        id="carrier"
        value={filters.carrier}
        onChange={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value.toUpperCase() }))}
      />

      <label htmlFor="advance-window">Advance window</label>
      <select
        id="advance-window"
        value={filters.advanceWindow}
        onChange={(e) => setFilters((prev) => ({ ...prev, advanceWindow: e.target.value }))}
      >
        <option value="">All</option>
        {ADVANCE_WINDOWS.map((window) => (
          <option key={window} value={window}>
            {window}
          </option>
        ))}
      </select>

      <label htmlFor="fare-class">Fare class</label>
      <input
        id="fare-class"
        value={filters.fareClass}
        onChange={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value }))}
        onBlur={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value.toUpperCase() }))}
      />
    </aside>
  );
}
