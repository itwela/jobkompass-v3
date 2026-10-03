/**
 * First-touch attribution. Stored in the browser before signup so the
 * campaign that brought someone in is still attached when they create
 * an account. Only short campaign labels and the referring host are kept.
 */

import { redactEmails } from "./privacy";

export const FIRST_TOUCH_STORAGE_KEY = "jk_first_touch_v1";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export type FirstTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer_host?: string;
  landing_path?: string;
};

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function cleanToken(value: string | null): string | undefined {
  if (!value) return undefined;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (decoded.includes("@")) return undefined;
  const cleaned = redactEmails(decoded).replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned || cleaned === "[redacted]") return undefined;
  return cleaned.slice(0, 80);
}

export function sanitizeReferrerHost(referrer: string, currentHost?: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (currentHost && url.host === currentHost) return undefined;
    const host = url.host.trim().toLowerCase();
    if (!host || host.length > 120) return undefined;
    if (host.includes("@")) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

export function readFirstTouch(storage: StorageLike | null | undefined): FirstTouch | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FIRST_TOUCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const touch: FirstTouch = {};
    for (const key of UTM_KEYS) {
      const value = cleanToken(typeof parsed[key] === "string" ? parsed[key] : null);
      if (value) touch[key] = value;
    }
    if (typeof parsed.referrer_host === "string") {
      const host = sanitizeReferrerHost(`https://${parsed.referrer_host}`);
      if (host) touch.referrer_host = host;
    }
    if (typeof parsed.landing_path === "string" && parsed.landing_path.startsWith("/")) {
      const path = redactEmails(parsed.landing_path).split("?")[0]?.slice(0, 160);
      if (path) touch.landing_path = path;
    }
    return touch;
  } catch {
    return null;
  }
}

export function captureFirstTouch(
  storage: StorageLike | null | undefined,
  input: { search: string; referrer: string; path: string; host?: string }
): FirstTouch | null {
  if (!storage) return null;
  const existing = readFirstTouch(storage);
  if (existing && Object.keys(existing).length > 0) return existing;

  const params = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  const touch: FirstTouch = {};
  for (const key of UTM_KEYS) {
    const value = cleanToken(params.get(key));
    if (value) touch[key] = value;
  }
  const referrerHost = sanitizeReferrerHost(input.referrer, input.host);
  if (referrerHost) touch.referrer_host = referrerHost;
  const path = input.path.split("?")[0] || "/";
  if (path.startsWith("/")) touch.landing_path = redactEmails(path).slice(0, 160);

  if (Object.keys(touch).length === 0) return null;
  try {
    storage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(touch));
  } catch {
    return touch;
  }
  return touch;
}

export function firstTouchProperties(touch: FirstTouch | null): Record<string, string> {
  if (!touch) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(touch)) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}
