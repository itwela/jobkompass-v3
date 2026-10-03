import { describe, expect, it } from "vitest";
import {
  isPublicReplayPath,
  isSensitivePath,
  isTrackingDeclined,
  redactEmails,
  safePageUrl,
  sanitizeAnalyticsValue,
  sanitizeHeatmapData,
  stripElementText,
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
    expect(isSensitivePath("/app/chat")).toBe(true);
  });

  it("records replay only on logged-out marketing pages", () => {
    expect(isPublicReplayPath("/")).toBe(true);
    expect(isPublicReplayPath("/pricing")).toBe(true);
    expect(isPublicReplayPath("/pricing/")).toBe(true);
    expect(isPublicReplayPath("/contact")).toBe(true);
    expect(isPublicReplayPath("/privacy")).toBe(true);
    expect(isPublicReplayPath("/terms")).toBe(true);
    expect(isPublicReplayPath("/waitlist")).toBe(true);
    expect(isPublicReplayPath("/app")).toBe(false);
    expect(isPublicReplayPath("/auth")).toBe(false);
    expect(isPublicReplayPath("/free-resume-generator")).toBe(false);
    expect(isPublicReplayPath("/stripe/success")).toBe(false);
    expect(isPublicReplayPath("/profile")).toBe(false);
  });

  it("keeps heatmap coordinates and drops the query string, text, and selectors", () => {
    const heatmap = sanitizeHeatmapData({
      "https://myjobkompass.com/app?email=ada@example.com&session_id=cs_test#name": [
        { x: 12, y: 40, target_fixed: false, type: "click", $el_text: "Ada Lovelace", selector: "button.name" },
      ],
    });
    expect(heatmap).toEqual({
      "https://myjobkompass.com/app": [{ x: 12, y: 40, target_fixed: false, type: "click" }],
    });
    const stripped = stripElementText({
      $el_text: "Get started",
      $elements: [{ tag_name: "button", $el_text: "Get started" }],
      path: "/pricing",
    }) as Record<string, unknown>;
    expect(stripped.$el_text).toBeUndefined();
    expect(stripped.$elements).toBeUndefined();
    expect(stripped.path).toBe("/pricing");
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
