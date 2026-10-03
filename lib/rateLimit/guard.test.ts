import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mutation, setAuth, clearAuth, convexAuthNextjsToken } = vi.hoisted(() => ({
  mutation: vi.fn(),
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
  convexAuthNextjsToken: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class ConvexHttpClient {
    mutation = mutation;
    setAuth = setAuth;
    clearAuth = clearAuth;
  },
}));

vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: () => convexAuthNextjsToken(),
}));

import { enforceAiRateLimit } from "./guard";

function request(ip?: string) {
  return new NextRequest("http://localhost/api/chat", {
    headers: ip ? { "x-forwarded-for": ip } : {},
  });
}

beforeEach(() => {
  mutation.mockReset();
  setAuth.mockReset();
  clearAuth.mockReset();
  convexAuthNextjsToken.mockReset();
  convexAuthNextjsToken.mockResolvedValue(null);
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://placeholder.convex.cloud";
  delete process.env.CONVEX_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enforceAiRateLimit", () => {
  it("allows the request when the limiter says ok", async () => {
    mutation.mockResolvedValue({ ok: true, retryAfter: 0 });
    const response = await enforceAiRateLimit(request("203.0.113.10"), "ai");
    expect(response).toBeNull();
    expect(mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bucket: "ai",
        anonymousKey: expect.stringMatching(/^ip:[a-f0-9]{32}$/),
      }),
    );
    const key = mutation.mock.calls[0][1].anonymousKey as string;
    expect(key).not.toContain("203.0.113.10");
  });

  it("returns 429 and Retry-After seconds when the bucket is exhausted", async () => {
    mutation.mockResolvedValue({ ok: false, retryAfter: 125_000 });
    const response = await enforceAiRateLimit(request(), "freeResume");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("125");
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    const body = await response?.json();
    expect(body.error).toBe("Too many requests. Please try again later.");
  });

  it("fails open when the Convex function is missing and does not log the IP", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mutation.mockRejectedValue(new Error("Could not find public function"));
    const response = await enforceAiRateLimit(request("203.0.113.50"), "ai");
    expect(response).toBeNull();
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("allowing request");
    expect(logged).not.toContain("203.0.113.50");
    expect(logged).not.toContain("Could not find");
  });

  it("fails open when Convex is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await enforceAiRateLimit(request(), "ai");
    expect(response).toBeNull();
    expect(mutation).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toContain("no Convex URL");
  });
});
