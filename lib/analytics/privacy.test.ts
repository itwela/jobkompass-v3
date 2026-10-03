import { describe, expect, it } from "vitest";
import {
  isSensitivePath,
  isTrackingDeclined,
  redactEmails,
  safePageUrl,
  sanitizeAnalyticsValue,
} from "./privacy";

describe("analytics privacy", () => {
  it("honors Do Not Track, Global Privacy Control, and the local opt-out flag", () => {
    expect(isTrackingDeclined({ doNotTrack: "1" })).toBe(true);
    expect(isTrackingDeclined({ doNotTrack: "yes" })).toBe(true);
    expect(isTrackingDeclined({ doNotTrack: "0" })).toBe(false);
    expect(isTrackingDeclined({ globalPrivacyControl: true })).toBe(true);
    expect(isTrackingDeclined({ optOut: "1" })).toBe(true);
    expect(isTrackingDeclined({})).toBe(false);
  });

  it("treats the app shell, free generator, and editor routes as sensitive", () => {
    expect(isSensitivePath("/app")).toBe(true);
    expect(isSensitivePath("/app/documents")).toBe(true);
    expect(isSensitivePath("/free-resume-generator")).toBe(true);
    expect(isSensitivePath("/resume-editor")).toBe(true);
    expect(isSensitivePath("/pricing")).toBe(false);
    expect(isSensitivePath("/auth")).toBe(true);
    expect(isSensitivePath("/profile")).toBe(true);
    expect(isSensitivePath("/stripe/success")).toBe(true);
    expect(isSensitivePath("/")).toBe(false);
  });

  it("strips emails and drops resume content, names, and nested document fields", () => {
    const cleaned = sanitizeAnalyticsValue({
      method: "password",
      email: "ada@example.com",
      name: "Ada Lovelace",
      content: { summary: "Built compilers" },
      note: "reach me at ada@example.com please",
      count: 1,
      ok: true,
    }) as Record<string, unknown>;

    expect(cleaned.email).toBeUndefined();
    expect(cleaned.name).toBeUndefined();
    expect(cleaned.content).toBeUndefined();
    expect(cleaned.method).toBe("password");
    expect(cleaned.note).toBe("reach me at [redacted] please");
    expect(cleaned.count).toBe(1);
    expect(cleaned.ok).toBe(true);
    expect(redactEmails("a@b.co and c@d.org")).toBe("[redacted] and [redacted]");
  });

  it("keeps PostHog's token and utm_content, which are not document fields", () => {
    const cleaned = sanitizeAnalyticsValue({
      token: "phc_test",
      utm_content: "spring",
      distinct_id: "user_1",
      content: "Built compilers at Example Corp",
    }) as Record<string, unknown>;
    expect(cleaned.token).toBe("phc_test");
    expect(cleaned.utm_content).toBe("spring");
    expect(cleaned.distinct_id).toBe("user_1");
    expect(cleaned.content).toBeUndefined();
  });

  it("replaces long free-text so a resume cannot ride along in a string", () => {
    const cleaned = sanitizeAnalyticsValue({ bio: "x".repeat(800) }) as Record<string, unknown>;
    expect(cleaned.bio).toBe("[redacted-long-text]");
  });

  it("keeps only utm query params on page urls", () => {
    const url = safePageUrl(
      "https://myjobkompass.com",
      "/pricing",
      "?utm_source=ph&utm_medium=post&session_id=cs_test&email=ada@example.com"
    );
    expect(url).toBe("https://myjobkompass.com/pricing?utm_source=ph&utm_medium=post");
    expect(url).not.toContain("session_id");
    expect(url).not.toContain("ada@");
  });
});
