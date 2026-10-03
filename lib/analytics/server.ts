/**
 * Server-side PostHog. No-ops when NEXT_PUBLIC_POSTHOG_KEY is unset.
 * Used for request errors only. Do not pass request bodies, cookies, or
 * resume fields into captureServerException.
 */
import { PostHog } from "posthog-node";
import { redactEmails, toScrubbedError } from "./privacy";

let client: PostHog | null | undefined;

export function getPostHogServer(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) {
    client = null;
    return null;
  }
  client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function shortLabel(value: string | undefined, max = 160): string | undefined {
  if (!value) return undefined;
  const cleaned = redactEmails(value).split("?")[0]?.trim() ?? "";
  if (!cleaned || cleaned.length > max || cleaned.includes("@")) return undefined;
  return cleaned;
}

export function serverExceptionProperties(input: {
  path?: string;
  method?: string;
  routerKind?: string;
  routePath?: string;
  routeType?: string;
}): Record<string, string> {
  const properties: Record<string, string> = { source: "server" };
  const path = shortLabel(input.path);
  if (path) properties.path = path;
  const method = input.method?.toUpperCase();
  if (method && METHODS.has(method)) properties.method = method;
  const routerKind = shortLabel(input.routerKind, 40);
  if (routerKind) properties.router_kind = routerKind;
  const routePath = shortLabel(input.routePath);
  if (routePath) properties.route_path = routePath;
  const routeType = shortLabel(input.routeType, 40);
  if (routeType) properties.route_type = routeType;
  return properties;
}

export function readDistinctIdFromCookie(cookieHeader: string | string[] | undefined): string | null {
  const cookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!cookie) return null;
  const match = cookie.match(/ph_phc_[^=]+_posthog=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as { distinct_id?: unknown };
    const id = parsed.distinct_id;
    if (typeof id !== "string") return null;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

export async function captureServerException(
  error: unknown,
  distinctId: string | null,
  properties: Record<string, string>
): Promise<void> {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    const scrubbed = toScrubbedError(error);
    await posthog.captureExceptionImmediate(scrubbed, distinctId ?? undefined, properties);
  } catch {
    // Error reporting must not hide the original request failure.
  }
}
