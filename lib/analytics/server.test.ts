import { describe, expect, it } from "vitest";
import { readDistinctIdFromCookie, serverExceptionProperties } from "./server";
import { toScrubbedError } from "./privacy";

describe("server error tracking", () => {
  it("reads only a safe distinct id from the PostHog cookie", () => {
    const payload = encodeURIComponent(JSON.stringify({ distinct_id: "user_123" }));
    const cookie = `ph_phc_test_posthog=${payload}; other=secret-token`;
    expect(readDistinctIdFromCookie(cookie)).toBe("user_123");
    expect(readDistinctIdFromCookie(`ph_phc_test_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: "ada@example.com" }))}`)).toBeNull();
    expect(readDistinctIdFromCookie(undefined)).toBeNull();
  });

  it("keeps route metadata and drops query strings and emails", () => {
    expect(
      serverExceptionProperties({
        path: "/api/resume/export/jake?email=ada@example.com",
        method: "POST",
        routerKind: "App Router",
        routePath: "/api/resume/export/[templateId]",
        routeType: "route",
      })
    ).toEqual({
      source: "server",
      path: "/api/resume/export/jake",
      method: "POST",
      router_kind: "App Router",
      route_path: "/api/resume/export/[templateId]",
      route_type: "route",
    });
  });

  it("scrubs emails and long messages out of exception text", () => {
    const error = new Error(`failed for ada@example.com ${"x".repeat(400)}`);
    error.stack = `Error: ada@example.com\n    at saveResume (/app/resume.ts:10:1)`;
    const scrubbed = toScrubbedError(error);
    expect(scrubbed.message).toBe("Error message redacted");
    expect(scrubbed.stack).not.toContain("ada@example.com");
    expect(scrubbed.stack).toContain("saveResume");
  });
});