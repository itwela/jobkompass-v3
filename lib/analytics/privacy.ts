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
    /editor/i.test(path)
  );
}

export function isSessionReplayRequested(): boolean {
  return process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY === "true";
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
export function sanitizeAnalyticsValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (typeof value === "string") {
    const redacted = redactEmails(value);
    if (redacted.length > 500) return "[redacted-long-text]";
    return redacted;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((item) => sanitizeAnalyticsValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isBlockedKey(key)) continue;
      const cleaned = sanitizeAnalyticsValue(nested, depth + 1);
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
