/**
 * Browser analytics. No-ops when NEXT_PUBLIC_POSTHOG_KEY is unset, when the
 * browser sends Do Not Track / Global Privacy Control, or when the visitor
 * has set localStorage jk_analytics_opt_out=1.
 *
 * Session replay is off unless NEXT_PUBLIC_POSTHOG_SESSION_REPLAY=true, and
 * even then every input and text node is masked and recording is stopped on
 * resume, document, and editor screens.
 */
import posthog from "posthog-js";
import { captureFirstTouch, firstTouchProperties, readFirstTouch } from "./attribution";
import {
  AnalyticsEvent,
  buildFirstResumeProperties,
  buildPaidConversionProperties,
  buildResumeExportedProperties,
  buildSignupProperties,
  buildUpgradeClickedProperties,
  checkoutPlanSelection,
} from "./events";
import {
  isSensitivePath,
  isSessionReplayRequested,
  isTrackingDeclinedInBrowser,
  safePageUrl,
  safePath,
  sanitizeAnalyticsValue,
} from "./privacy";

const SIGNUP_DEDUPE_KEY = "jk_signup_tracked";
const RESUME_SOURCE_KEY = "jk_resume_create_source";

let initialized = false;

export function hasAnalyticsKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function captureFirstTouchFromBrowser(): void {
  if (typeof window === "undefined") return;
  if (isTrackingDeclinedInBrowser()) return;
  const storage = browserStorage();
  if (!storage) return;
  captureFirstTouch(storage, {
    search: window.location.search,
    referrer: document.referrer,
    path: window.location.pathname,
    host: window.location.host,
  });
}

function registerFirstTouch(): void {
  const storage = browserStorage();
  const props = firstTouchProperties(readFirstTouch(storage));
  if (Object.keys(props).length > 0) {
    posthog.register(props);
  }
}

function sanitizeProperties<T>(properties: T): T {
  if (!properties || typeof properties !== "object") return properties;
  const cleaned = sanitizeAnalyticsValue(properties);
  if (!cleaned || typeof cleaned !== "object" || Array.isArray(cleaned)) {
    return {} as T;
  }
  return cleaned as T;
}

export function initAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  if (initialized) return true;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return false;
  if (isTrackingDeclinedInBrowser()) return false;

  captureFirstTouchFromBrowser();

  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      // Exception autocapture is turned on in the error-tracking setup.
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: "identified_only",
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        maskTextFn: () => "*",
        maskInputFn: () => "*",
        maskAllElementAttributes: true,
        recordBody: false,
        streamNetworkBody: false,
        captureJsonLd: false,
        blockSelector: 'input[type="file"], iframe',
        maskCapturedNetworkRequestFn: () => null,
      },
      before_send: (event) => {
        if (!event) return null;
        event.properties = sanitizeProperties(event.properties);
        if (event.$set) event.$set = sanitizeProperties(event.$set);
        if (event.$set_once) event.$set_once = sanitizeProperties(event.$set_once);
        return event;
      },
      loaded: (instance) => {
        instance.stopSessionRecording();
      },
    });
    initialized = true;
    registerFirstTouch();
    syncSessionReplay(window.location.pathname);
    return true;
  } catch {
    initialized = false;
    return false;
  }
}

export function syncSessionReplay(pathname: string): void {
  if (!initialized) return;
  if (!isSessionReplayRequested() || isSensitivePath(pathname)) {
    posthog.stopSessionRecording();
    return;
  }
  posthog.startSessionRecording();
}

function capture(event: string, properties: Record<string, string | number | boolean>): void {
  if (!initAnalytics()) return;
  posthog.capture(event, properties);
}

export function capturePageview(pathname: string, search: string): void {
  if (typeof window === "undefined") return;
  captureFirstTouchFromBrowser();
  if (!initAnalytics()) return;
  const path = safePath(pathname);
  syncSessionReplay(path);
  capture(AnalyticsEvent.pageview, {
    path,
    $current_url: safePageUrl(window.location.origin, path, search),
  });
}

function isSafeUserId(userId: string): boolean {
  return /^[A-Za-z0-9]{1,128}$/.test(userId);
}

export function identifyUser(userId: string): void {
  if (!isSafeUserId(userId)) return;
  if (!initAnalytics()) return;
  const props = firstTouchProperties(readFirstTouch(browserStorage()));
  posthog.identify(userId, undefined, Object.keys(props).length > 0 ? props : undefined);
}

export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
  registerFirstTouch();
}

export function trackSignup(): void {
  if (!initAnalytics()) return;
  try {
    if (window.sessionStorage.getItem(SIGNUP_DEDUPE_KEY) === "1") return;
    capture(AnalyticsEvent.signup, buildSignupProperties());
    window.sessionStorage.setItem(SIGNUP_DEDUPE_KEY, "1");
  } catch {
    capture(AnalyticsEvent.signup, buildSignupProperties());
  }
}

export function markResumeCreateSource(source: "upload" | "paste" | "generated" | "chat" | "free_generator"): void {
  try {
    window.sessionStorage.setItem(RESUME_SOURCE_KEY, source);
  } catch {
    // Private mode can reject storage; the event still fires with source in_app.
  }
}

function consumeResumeCreateSource(): string {
  try {
    const value = window.sessionStorage.getItem(RESUME_SOURCE_KEY);
    window.sessionStorage.removeItem(RESUME_SOURCE_KEY);
    return value || "in_app";
  } catch {
    return "in_app";
  }
}

export function trackFirstResumeCreated(userKey: string, source?: string | null, templateId?: string | null): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userKey)) return;
  if (!initAnalytics()) return;
  const storageKey = `jk_first_resume_tracked:${userKey}`;
  try {
    if (window.localStorage.getItem(storageKey) === "1") return;
  } catch {
    return;
  }
  capture(AnalyticsEvent.firstResumeCreated, buildFirstResumeProperties({ source, template_id: templateId }));
  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // The event was sent; a later duplicate is acceptable if storage is blocked.
  }
}

export function trackResumeExported(input: { method: "download" | "export"; template_id?: string | null }): void {
  const properties = buildResumeExportedProperties(input);
  if (!properties) return;
  capture(AnalyticsEvent.resumeExported, properties);
}

export function trackUpgradeClicked(input: {
  surface: string;
  plan_id?: string | null;
  interval?: string | null;
  authenticated: boolean;
}): void {
  const properties = buildUpgradeClickedProperties(input);
  if (!properties) return;
  capture(AnalyticsEvent.upgradeClicked, properties);
}

export function trackPlanUpgrade(input: {
  surface: "pricing" | "pricing_modal";
  planId: string;
  isAnnual: boolean;
  isOneTime: boolean;
  authenticated: boolean;
}): void {
  const selection = checkoutPlanSelection(input.planId, input.isAnnual, input.isOneTime);
  trackUpgradeClicked({
    surface: input.surface,
    plan_id: selection?.plan_id,
    interval: selection?.interval,
    authenticated: input.authenticated,
  });
}

export function trackPaidConversion(
  input: { plan_id?: string | null; interval?: string | null },
  dedupeKey?: string | null
): void {
  if (!initAnalytics()) return;
  const safeKey = dedupeKey && /^[A-Za-z0-9_]{1,120}$/.test(dedupeKey) ? dedupeKey : "checkout";
  const storageKey = `jk_paid_conversion:${safeKey}`;
  try {
    if (window.sessionStorage.getItem(storageKey) === "1") return;
  } catch {
    // continue without dedupe
  }
  capture(AnalyticsEvent.paidConversion, buildPaidConversionProperties(input));
  try {
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // ignore
  }
}

export function readPendingResumeSource(): string {
  return consumeResumeCreateSource();
}
