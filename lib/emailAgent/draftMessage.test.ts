// lib/emailAgent/draftMessage.test.ts
import { describe, expect, it } from "vitest";
import { parseDraftMessageResponse } from "./draftMessage";

describe("parseDraftMessageResponse", () => {
  it("extracts message text from a plain response", () => {
    expect(parseDraftMessageResponse("Hi Jane, thanks for reaching out!")).toBe(
      "Hi Jane, thanks for reaching out!"
    );
  });

  it("strips a leading/trailing quote wrapper if present", () => {
    expect(parseDraftMessageResponse('"Hi Jane, thanks for reaching out!"')).toBe(
      "Hi Jane, thanks for reaching out!"
    );
  });

  it("returns null for an empty response", () => {
    expect(parseDraftMessageResponse("   ")).toBeNull();
  });
});
