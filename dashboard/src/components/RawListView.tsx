import { useFilters } from "../context/FilterContext";
import { useFareRecords } from "../hooks/useFareRecords";
import AnalyticsLoadingSkeleton from "./AnalyticsLoadingSkeleton";
import ExportButton from "./ExportButton";

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDelta(value: number | null): string {
  if (value === null) return "-";
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(rounded))}`;
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

export default function RawListView() {
  const { appliedFilters: filters } = useFilters();
  const { data, loading, error } = useFareRecords({
    routes: filters.selectedRoutes,
    sources: filters.sources,
    carrier: filters.carrier,
    advanceWindow: filters.advanceWindow,
    fareClass: filters.fareClass,
    start: filters.startDate,
    end: filters.endDate,
  });

  if (loading && !data) return <AnalyticsLoadingSkeleton title="List view" variant="table" />;
  if (error && !data) return (
    <p role="alert" className="text-sm text-error">
      Failed to load fare records: {error}
    </p>
  );
  if (!data || data.records.length === 0) {
    return <p className="text-sm text-secondary">No fare records available yet.</p>;
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-error">
          Search failed: {error}
        </p>
      )}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-primary">List view</h2>
          <p className="font-mono text-sm text-secondary">
            Mean fare: {formatCurrency(data.mean_total_fare)} / Records: {data.records.length}
          </p>
        </div>
        <ExportButton data={data.records} filename="fare-records.csv" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                "Collected",
                "Travel",
                "Route",
                "Source",
                "Carrier",
                "Window",
                "Class",
                "Routing",
                "Status",
                "Price",
                "Vs mean",
              ].map((heading) => (
                <th
                  key={heading}
                  className="border border-line bg-panel px-3 py-2 text-left font-medium text-secondary"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.records.map((record) => (
              <tr key={record.quote_id}>
                <td className="border border-line px-3 py-2 font-mono text-primary">
                  {formatDateTime(record.collected_at)}
                </td>
                <td className="border border-line px-3 py-2 font-mono text-primary">
                  {record.travel_date}
                </td>
                <td className="border border-line px-3 py-2 text-primary">{record.route}</td>
                <td className="border border-line px-3 py-2 text-primary">{record.source}</td>
                <td className="border border-line px-3 py-2 font-mono text-primary">
                  {record.carrier}
                </td>
                <td className="border border-line px-3 py-2 font-mono text-primary">
                  {record.advance_window}
                </td>
                <td className="border border-line px-3 py-2 font-mono text-primary">
                  {record.fare_class ?? "-"}
                </td>
                <td className="border border-line px-3 py-2 text-primary">{record.routing ?? "-"}</td>
                <td className="border border-line px-3 py-2 text-primary">
                  {record.is_outlier ? `${record.status} / outlier` : record.status}
                </td>
                <td className="border border-line px-3 py-2 text-right font-mono text-primary">
                  {formatCurrency(record.total_fare)}
                </td>
                <td className="border border-line px-3 py-2 text-right font-mono text-primary">
                  {formatDelta(record.delta_from_mean)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
