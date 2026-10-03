/**
 * Privacy guards for product analytics.
 * Resumes are sensitive: events may carry ids, counts, booleans, and short
 * slugs only. Names, emails, and document text are stripped before send.
 */

export const OPT_OUT_STORAGE_KEY = "jk_analytics_opt_out";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Exact property names that must never leave the browser.
 * Matching is on the normalized key so `utm_content` is kept and `content` is not.
 * `token` is PostHog's project key field; stripping it makes ingest drop the event.
 */
const BLOCKED_EXACT_KEYS = new Set([
  "email",
  "e-mail",
  "name",
  "firstname",
  "lastname",
  "fullname",
  "first_name",
  "last_name",
  "full_name",
  "password",
  "passwd",
  "secret",
  "cookie",
  "authorization",
  "bearer",
  "content",
  "resume",
  "phone",
  "address",
  "ssn",
  "username",
  "personal",
  "personalinfo",
  "personal_info",
  "message",
  "body",
  "prompt",
  "latex",
  "pdf",
  "context_line",
  "pre_context",
  "post_context",
  "vars",
]);

const BLOCKED_KEY_RE = /(email|password|passwd|secret|cookie|authorization|bearer|firstname|lastname|fullname|username|personalinfo)/;

const PLAN_IDS = new Set([
  "starter",
  "plus",
  "plus-annual",
  "pro",
  "pro-annual",
]);

const INTERVALS = new Set(["month", "year", "one_time"]);

const RESUME_SOURCES = new Set([
  "upload",
  "paste",
  "generated",
  "chat",
  "free_generator",
  "in_app",
]);

const EXPORT_METHODS = new Set(["download", "export"]);

const UPGRADE_SURFACES = new Set([
  "pricing",
  "pricing_modal",
  "upgrade_button",
  "upgrade_modal",
  "upgrade_prompt",
  "header",
  "sidebar",
  "performance",
  "settings",
  "search",
]);

const TEMPLATE_IDS = new Set(["jake", "joseph", "mar"]);

const CTA_IDS = new Set(["signup", "free_generator"]);

const CTA_SURFACES = new Set(["hero", "header", "midpage", "sticky"]);

export type AnalyticsSignals = {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  optOut?: string | null;
};

export function isTrackingDeclined(signals: AnalyticsSignals): boolean {
  if (signals.optOut === "1") return true;
  const dnt = signals.doNotTrack;
  if (dnt === "1" || dnt === "yes") return true;
  if (signals.globalPrivacyControl === true) return true;
  return false;
}

export function readBrowserTrackingSignals(): AnalyticsSignals {
  if (typeof window === "undefined") {
    return { doNotTrack: null, globalPrivacyControl: false, optOut: null };
  }
  const nav = navigator as Navigator & {
    msDoNotTrack?: string;
    globalPrivacyControl?: boolean;
  };
  const win = window as Window & { doNotTrack?: string };
  let optOut: string | null = null;
  try {
    optOut = window.localStorage.getItem(OPT_OUT_STORAGE_KEY);
  } catch {
    optOut = null;
  }
  return {
    doNotTrack: nav.doNotTrack || win.doNotTrack || nav.msDoNotTrack || null,
    globalPrivacyControl: nav.globalPrivacyControl === true,
    optOut,
  };
}

export function isTrackingDeclinedInBrowser(): boolean {
  return isTrackingDeclined(readBrowserTrackingSignals());
}

export function redactEmails(value: string): string {
  return value.replace(EMAIL_RE, "[redacted]");
}

export function isSensitivePath(pathname: string): boolean {
  const path = (pathname || "/").split("?")[0] || "/";
  return (
    /^\/app(?:\/|$)/.test(path) ||
    /^\/free-resume-generator(?:\/|$)/.test(path) ||
    /^\/auth(?:\/|$)/.test(path) ||
    /^\/profile(?:\/|$)/.test(path) ||
    /^\/stripe(?:\/|$)/.test(path) ||
    /\/resume(?:\/|$|-)/i.test(path) ||
    /\/documents?(?:\/|$)/i.test(path) ||
    /chat/i.test(path) ||
    /editor/i.test(path)
  );
}

/**
 * Logged-out marketing pages. Session replay may run only on these paths.
 * Everything else, including the app, auth, resumes, and the free generator, never records.
 */
const PUBLIC_REPLAY_PATHS = new Set(["/", "/pricing", "/contact", "/privacy", "/terms", "/waitlist"]);

export function normalizePath(pathname: string): string {
  const path = (pathname || "/").split("?")[0]?.split("#")[0] || "/";
  if (!path.startsWith("/")) return "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function isPublicReplayPath(pathname: string): boolean {
  return PUBLIC_REPLAY_PATHS.has(normalizePath(pathname));
}

/**
 * Replay gate. The default is public-pages-only (the safe behavior).
 * `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY=false` turns replay off entirely.
 * No value records the authenticated app, chat, or document screens.
 */
export function isSessionReplayEnabled(): boolean {
  return process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY !== "false";
}

export function pageKind(pathname: string): "landing" | "pricing" | "other" {
  const path = normalizePath(pathname);
  if (path === "/") return "landing";
  if (path === "/pricing") return "pricing";
  return "other";
}

function isBlockedKey(key: string): boolean {
  if (key.startsWith("$")) return false;
  if (key === "token" || key === "distinct_id") return false;
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (BLOCKED_EXACT_KEYS.has(normalized) || BLOCKED_EXACT_KEYS.has(key.toLowerCase())) return true;
  return BLOCKED_KEY_RE.test(normalized);
}

/**
 * Walk an analytics payload and drop anything that could be resume text,
 * a name, or an email. Nested objects are kept only for PostHog's own
 * `$…` exception metadata, with strings redacted.
 */
function cleanAnalyticsString(key: string, value: string): string {
  const redacted = redactEmails(value);
  if (/(\$exception_message|\$exception_value|^value$|^message$)/i.test(key)) {
    return redacted.length > 180 ? "[redacted-long-text]" : redacted;
  }
  if (/stack|filename|function|abs_path|module/i.test(key)) {
    return redacted.slice(0, 2000);
  }
  if (redacted.length > 300) return "[redacted-long-text]";
  return redacted;
}

export function sanitizeAnalyticsValue(value: unknown, depth = 0, key = ""): unknown {
  if (depth > 6) return undefined;
  if (typeof value === "string") {
    return cleanAnalyticsString(key, value);
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((item) => sanitizeAnalyticsValue(item, depth + 1, key))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isBlockedKey(key)) continue;
      const cleaned = sanitizeAnalyticsValue(nested, depth + 1, key);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return undefined;
}

export function slug(value: string | null | undefined, allowed: Set<string>): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  return allowed.has(trimmed) ? trimmed : undefined;
}

export function planId(value: string | null | undefined): string | undefined {
  return slug(value, PLAN_IDS);
}

export function billingInterval(value: string | null | undefined): string | undefined {
  return slug(value, INTERVALS);
}

export function resumeSource(value: string | null | undefined): string {
  return slug(value, RESUME_SOURCES) ?? "in_app";
}

export function exportMethod(value: string | null | undefined): string | undefined {
  return slug(value, EXPORT_METHODS);
}

export function upgradeSurface(value: string | null | undefined): string | undefined {
  return slug(value, UPGRADE_SURFACES);
}

export function templateId(value: string | null | undefined): string | undefined {
  return slug(value, TEMPLATE_IDS);
}

export function ctaId(value: string | null | undefined): string | undefined {
  return slug(value, CTA_IDS);
}

export function ctaSurface(value: string | null | undefined): string | undefined {
  return slug(value, CTA_SURFACES);
}

export function toScrubbedError(error: unknown): Error {
  const raw = error instanceof Error ? error : new Error("Unknown error");
  const message = redactEmails(raw.message || "Unknown error");
  const safeMessage = message.length > 180 ? "Error message redacted" : message || "Unknown error";
  const scrubbed = new Error(safeMessage);
  const name = raw.name && raw.name.length <= 80 && !raw.name.includes("@") ? raw.name : "Error";
  scrubbed.name = name;
  if (raw.stack) {
    scrubbed.stack = redactEmails(raw.stack).slice(0, 2000);
  }
  return scrubbed;
}

export function safePath(pathname: string): string {
  const path = (pathname || "/").split("?")[0] || "/";
  if (!path.startsWith("/")) return "/";
  const cleaned = redactEmails(path);
  if (cleaned.length > 160) return "/";
  return cleaned;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function safePageUrl(origin: string, pathname: string, search: string): string {
  const path = safePath(pathname);
  let host = "https://jobkompass.local";
  try {
    host = new URL(origin).origin;
  } catch {
    host = "https://jobkompass.local";
  }
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const kept = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (decoded.includes("@") || decoded.toLowerCase().includes("%40")) continue;
  const cleaned = redactEmails(decoded).trim().slice(0, 80);
  if (cleaned && cleaned !== "[redacted]") kept.set(key, cleaned);
  }
  const qs = kept.toString();
  return qs ? `${host}${path}?${qs}` : `${host}${path}`;
}

/** Absolute URL reduced to origin, path, and utm params. Hash and other query params are dropped. */
export function safeAbsoluteUrl(value: string): string {
  try {
    const url = new URL(value);
    return safePageUrl(url.origin, url.pathname, url.search);
  } catch {
    if (value.startsWith("/")) return safePath(value.split("?")[0] || "/");
    return "/";
  }
}

const HEATMAP_TYPES = new Set(["click", "mousemove", "rageclick", "deadclick"]);

/**
 * posthog-js 1.435.8 stores heatmap points as {x, y, target_fixed, type} under the
 * raw page URL. There is no element text, selector, or input value on the point.
 * The URL key can still carry a query string, so it is rewritten here.
 */
export function sanitizeHeatmapData(data: unknown): Record<string, Array<Record<string, string | number | boolean>>> | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const out: Record<string, Array<Record<string, string | number | boolean>>> = {};
  for (const [rawUrl, points] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(points)) continue;
    const url = safeAbsoluteUrl(rawUrl);
    const cleaned: Array<Record<string, string | number | boolean>> = [];
    for (const point of points.slice(0, 80)) {
      if (!point || typeof point !== "object") continue;
      const record = point as Record<string, unknown>;
      if (typeof record.x !== "number" || typeof record.y !== "number") continue;
      if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) continue;
      const type = typeof record.type === "string" && HEATMAP_TYPES.has(record.type) ? record.type : "click";
      cleaned.push({
        x: record.x,
        y: record.y,
        target_fixed: record.target_fixed === true,
        type,
      });
    }
    if (cleaned.length === 0) continue;
    out[url] = [...(out[url] ?? []), ...cleaned].slice(0, 80);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const ELEMENT_TEXT_KEYS = new Set(["$el_text", "$elements", "$elements_chain", "$selected_content", "el_text"]);

/** Drop autocapture text fields wherever they appear, including nested objects. */
export function stripElementText(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => stripElementText(item, depth + 1));
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (ELEMENT_TEXT_KEYS.has(key)) continue;
    out[key] = stripElementText(nested, depth + 1);
  }
  return out;
}
