interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
}

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? "")).join(","));
  }
  return lines.join("\n");
}

export default function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
}: ExportButtonProps<T>) {
  function handleClick() {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={handleClick} disabled={data.length === 0}>
      Export CSV
    </button>
  );
}
