/**
 * Allowed product events. Builders drop anything outside the property
 * allowlist so call sites cannot attach resume text, names, or emails.
 */

import {
  billingInterval,
  exportMethod,
  planId,
  resumeSource,
  templateId,
  upgradeSurface,
} from "./privacy";

export const AnalyticsEvent = {
  signup: "signup",
  firstResumeCreated: "first_resume_created",
  resumeExported: "resume_exported",
  upgradeClicked: "upgrade_clicked",
  paidConversion: "paid_conversion",
  pageview: "$pageview",
} as const;

export function buildSignupProperties(): Record<string, string> {
  return { method: "password" };
}

export function buildFirstResumeProperties(input: {
  source?: string | null;
  template_id?: string | null;
}): Record<string, string | boolean> {
  const properties: Record<string, string | boolean> = {
    is_first: true,
    source: resumeSource(input.source),
  };
  const template = templateId(input.template_id);
  if (template) properties.template_id = template;
  return properties;
}

export function buildResumeExportedProperties(input: {
  method?: string | null;
  template_id?: string | null;
}): Record<string, string> | null {
  const method = exportMethod(input.method);
  if (!method) return null;
  const properties: Record<string, string> = { method, format: "pdf" };
  const template = templateId(input.template_id);
  if (template) properties.template_id = template;
  return properties;
}

export function buildUpgradeClickedProperties(input: {
  surface?: string | null;
  plan_id?: string | null;
  interval?: string | null;
  authenticated: boolean;
}): Record<string, string | boolean> | null {
  const surface = upgradeSurface(input.surface);
  if (!surface) return null;
  const properties: Record<string, string | boolean> = {
    surface,
    authenticated: input.authenticated,
  };
  const plan = planId(input.plan_id);
  if (plan) properties.plan_id = plan;
  const interval = billingInterval(input.interval);
  if (interval) properties.interval = interval;
  return properties;
}

export function buildPaidConversionProperties(input: {
  plan_id?: string | null;
  interval?: string | null;
}): Record<string, string> {
  const properties: Record<string, string> = { source: "checkout_success" };
  const plan = planId(input.plan_id);
  if (plan) properties.plan_id = plan;
  const interval = billingInterval(input.interval);
  if (interval) properties.interval = interval;
  return properties;
}

export function checkoutPlanSelection(
  planIdValue: string,
  isAnnual: boolean,
  isOneTime: boolean
): { plan_id: string; interval: string } | null {
  if (isOneTime || planIdValue === "starter") {
    return { plan_id: "starter", interval: "one_time" };
  }
  if (planIdValue === "plus") {
    return { plan_id: isAnnual ? "plus-annual" : "plus", interval: isAnnual ? "year" : "month" };
  }
  if (planIdValue === "pro") {
    return { plan_id: isAnnual ? "pro-annual" : "pro", interval: isAnnual ? "year" : "month" };
  }
  return null;
}
