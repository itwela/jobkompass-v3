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

  // A digest of 30+ jobs overruns the model's max_tokens, so the response arrives
  // cut off mid-listing (finish_reason: "length"). Dropping the whole email loses
  // every job in it — salvage the listings that did come through intact.
  describe("truncated digest responses", () => {
    it("recovers the complete listings from a response cut off mid-listing", () => {
      const truncated =
        '{"type": "digest", "listings": [' +
        '{"company": "Mint CRM", "role": "Web Designer", "link": "https://indeed.com/1"}, ' +
        '{"company": "Acme Health", "role": "Frontend Engineer", "link": "https://indeed.com/2"}, ' +
        '{"company": "Vertex Labs", "role": "UX Desig';

      expect(parseClassificationResponse(truncated)).toEqual({
        type: "digest",
        listings: [
          { company: "Mint CRM", role: "Web Designer", link: "https://indeed.com/1" },
          { company: "Acme Health", role: "Frontend Engineer", link: "https://indeed.com/2" },
        ],
      });
    });

    it("recovers when the cut lands right after a listing's closing brace", () => {
      const truncated =
        '{"type": "digest", "listings": [' +
        '{"company": "Mint CRM", "role": "Web Designer", "link": "https://indeed.com/1"},';

      expect(parseClassificationResponse(truncated)).toEqual({
        type: "digest",
        listings: [{ company: "Mint CRM", role: "Web Designer", link: "https://indeed.com/1" }],
      });
    });

    it("returns null when the cut lands before any listing completed", () => {
      const truncated = '{"type": "digest", "listings": [{"company": "Mint CR';
      expect(parseClassificationResponse(truncated)).toBeNull();
    });

    it("does not try to salvage a truncated non-digest response", () => {
      const truncated = '{"type": "personal_outreach", "company": "Acme", "role": "Eng';
      expect(parseClassificationResponse(truncated)).toBeNull();
    });
  });
});
