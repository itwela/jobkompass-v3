import { createHash } from "crypto";

type HeaderSource = { get(name: string): string | null };

/**
 * Stable per-IP key. The raw address is hashed and never stored or logged.
 * Missing or oversized proxy headers share `ip:unknown`.
 */
export function anonymousKeyFromHeaders(headers: HeaderSource): string {
  const forwarded = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");
  const raw = (forwarded?.split(",")[0] ?? realIp ?? "").trim();
  if (!raw || raw.length > 128) return "ip:unknown";
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  return `ip:${hash}`;
}
