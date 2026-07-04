export function resolveDate(input: string): string {
  const lower = input.trim().toLowerCase();
  const base = new Date();
  if (lower === "today") return toIso(base);
  if (lower === "yesterday") {
    base.setDate(base.getDate() - 1);
    return toIso(base);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;
  throw new Error(`Invalid date '${input}'. Use today, yesterday, or YYYY-MM-DD.`);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
