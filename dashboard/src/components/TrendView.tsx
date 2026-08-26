import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useIndexSeries } from "../hooks/useIndexSeries";
import ExportButton from "./ExportButton";

const TOOLTIP_STYLE = { backgroundColor: "#12161f", border: "1px solid #1e2530", borderRadius: 6 };
const TOOLTIP_LABEL_STYLE = { color: "#e5e7eb" };
// Numeric values (Y-axis ticks, tooltip line values) get the mono font, per
// the design spec's "all numeric data" rule -- text labels (X-axis periods,
// legend series names) stay in the default sans font.
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";
const TOOLTIP_ITEM_STYLE = { fontFamily: MONO_FONT };

export default function TrendView() {
  const { filters } = useFilters();
  const { data, loading, error } = useIndexSeries(filters.frequency, filters.startDate, filters.endDate);

  if (loading) return <p className="text-sm text-secondary">Loading trend data...</p>;
  if (error) return (
    <p role="alert" className="text-sm text-error">
      Failed to load trend data: {error}
    </p>
  );
  if (!data || data.series.length === 0) return <p className="text-sm text-secondary">No index data available yet.</p>;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-primary">Trend view</h2>
      <p className="mb-4 font-mono text-sm text-secondary">Base period: {data.series[0].base_period}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
          <XAxis dataKey="period" stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af", fontSize: 12, fontFamily: MONO_FONT }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          {/* Line colors map to index.css tokens: accent/up/down/warning. fisher gets a
              dash pattern (not just color) so it stays distinguishable from laspeyres
              for colorblind viewers -- see code-quality review. */}
          <Line type="monotone" dataKey="simple_relative" stroke="#a78bfa" />
          <Line type="monotone" dataKey="laspeyres" stroke="#4ade80" />
          <Line type="monotone" dataKey="paasche" stroke="#f0b429" />
          <Line type="monotone" dataKey="fisher" stroke="#f87171" strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ExportButton data={data.series} filename="trend.csv" />
      </div>
    </div>
  );
}
