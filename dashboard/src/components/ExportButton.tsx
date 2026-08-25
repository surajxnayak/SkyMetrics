interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
}

function csvEscape(value: unknown): string {
  const str = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = Array.from(headerSet);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
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
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <button onClick={handleClick} disabled={data.length === 0}>
      Export CSV
    </button>
  );
}
