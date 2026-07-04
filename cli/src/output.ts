function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderPretty(data: unknown): string {
  if (data === null || data === undefined) return "(none)";
  if (Array.isArray(data)) {
    if (data.length === 0) return "(none)";
    if (typeof data[0] !== "object" || data[0] === null) return data.map(cell).join("\n");
    const rows = data as Record<string, unknown>[];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => cell(r[c]).length)));
    const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join("  ");
    return [line(cols), ...rows.map((r) => line(cols.map((c) => cell(r[c]))))].join("\n");
  }
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${cell(v)}`)
      .join("\n");
  }
  return String(data);
}

export function emit(data: unknown, opts: { json?: boolean } = {}): void {
  const machine = opts.json || !process.stdout.isTTY;
  process.stdout.write((machine ? JSON.stringify(data, null, 2) : renderPretty(data)) + "\n");
}
