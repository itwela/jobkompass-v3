/**
 * Formatting for the Agent activity page (D27-D29, M26-M27). Pure, so it is unit-tested.
 * Values the agent did not report render as an em dash, never as 0.
 */

export const NONE = "—";

/** 0.976 -> "97.6%"; 1 -> "100%" (as the frames write it). */
export function fmtRate(rate: number): string {
  const pct = Math.round(rate * 1000) / 10;
  return pct === 100 ? "100%" : `${pct.toFixed(1)}%`;
}

/** 7800 -> "7.8s", 400 -> "0.4s", 125000 -> "125s". null -> "—". */
export function fmtSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return NONE;
  const s = ms / 1000;
  return s >= 100 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
}

/**
 * Token counts. `short` = table style (1.12M, 540K); headline style keeps one decimal on
 * millions (2.0M). Nothing reported -> "—".
 */
export function fmtTokens(n: number, reported: boolean, style: "table" | "headline" = "table"): string {
  if (!reported) return NONE;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(style === "headline" ? 1 : 2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** $27.90; under a cent shows "<$0.01"; nothing reported -> "—". */
export function fmtCost(usd: number, reported: boolean): string {
  if (!reported) return NONE;
  if (usd > 0 && usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

/** 18240 -> "18,240". */
export const fmtInt = (n: number) => n.toLocaleString("en-US");

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Feed time column: "14:32" today, "Nov 18" before. Local time. */
export function fmtFeedTime(ts: number, now: number = Date.now()): string {
  const d = new Date(ts);
  if (ts >= startOfDay(now)) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Details header: "today at 12:47" / "Nov 18 at 09:02". */
export function fmtWhen(ts: number, now: number = Date.now()): string {
  const d = new Date(ts);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return ts >= startOfDay(now) ? `today at ${hm}` : `${MONTHS[d.getMonth()]} ${d.getDate()} at ${hm}`;
}

/** Details "Started": "2026-11-19 12:47:08". Local time. */
export function fmtStamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export type ActivityRange = "7d" | "30d" | "all";

/** Lower bound of the range toggle, or undefined for All time. */
export function rangeFrom(range: ActivityRange, now: number = Date.now()): number | undefined {
  if (range === "all") return undefined;
  return startOfDay(now) - (range === "7d" ? 6 : 29) * 86_400_000;
}

/** "18,240 in · 6,110 out" from whichever side was reported. */
export function fmtTokenSplit(input?: number, output?: number): string {
  const parts: string[] = [];
  if (typeof input === "number") parts.push(`${fmtInt(input)} in`);
  if (typeof output === "number") parts.push(`${fmtInt(output)} out`);
  return parts.length ? parts.join(" · ") : NONE;
}
