import { describe, expect, it } from "vitest";
import { parseClassificationResponse } from "./classify";

describe("parseClassificationResponse", () => {
  it("parses a personal outreach response", () => {
    const raw = JSON.stringify({
      type: "personal_outreach",
      company: "Acme Corp",
      role: "Senior Engineer",
      senderName: "Jane Recruiter",
    });
    expect(parseClassificationResponse(raw)).toEqual({
      type: "personal_outreach",
      company: "Acme Corp",
      role: "Senior Engineer",
      senderName: "Jane Recruiter",
    });
  });

  it("parses a digest response with multiple listings", () => {
    const raw = JSON.stringify({
      type: "digest",
      listings: [
        { company: "Acme Corp", role: "Backend Engineer", link: "https://example.com/1" },
        { company: "Widget Co", role: "Frontend Engineer", link: "https://example.com/2" },
      ],
    });
    expect(parseClassificationResponse(raw)).toEqual({
      type: "digest",
      listings: [
        { company: "Acme Corp", role: "Backend Engineer", link: "https://example.com/1" },
        { company: "Widget Co", role: "Frontend Engineer", link: "https://example.com/2" },
      ],
    });
  });

  it("strips markdown code fences before parsing", () => {
    const raw = '```json\n{"type":"neither"}\n```';
    expect(parseClassificationResponse(raw)).toEqual({ type: "neither" });
  });

  it("returns null for malformed JSON", () => {
    expect(parseClassificationResponse("not json at all")).toBeNull();
  });

  it("returns null for an unrecognized type value", () => {
    expect(parseClassificationResponse('{"type":"spam"}')).toBeNull();
  });
});
