import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilters } from "../context/FilterContext";
import { useIndexSeries } from "../hooks/useIndexSeries";
import ExportButton from "./ExportButton";

export default function TrendView() {
  const { filters } = useFilters();
  const { data, loading, error } = useIndexSeries(filters.frequency, filters.startDate, filters.endDate);

  if (loading) return <p>Loading trend data...</p>;
  if (error) return <p role="alert">Failed to load trend data: {error}</p>;
  if (!data || data.series.length === 0) return <p>No index data available yet.</p>;

  return (
    <div>
      <h2>Trend view</h2>
      <p>Base period: {data.series[0].base_period}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="simple_relative" stroke="#8884d8" />
          <Line type="monotone" dataKey="laspeyres" stroke="#82ca9d" />
          <Line type="monotone" dataKey="paasche" stroke="#ffc658" />
          <Line type="monotone" dataKey="fisher" stroke="#ff7300" />
        </LineChart>
      </ResponsiveContainer>
      <ExportButton data={data.series} filename="trend.csv" />
    </div>
  );
}
