import { describe, expect, it } from "vitest";
import { plainPunctuation } from "./plainPunctuation";

describe("plainPunctuation", () => {
  it("replaces em and en dashes between clauses with a comma", () => {
    expect(plainPunctuation("Hey—how can I help you today?")).toBe("Hey, how can I help you today?");
    expect(plainPunctuation("Hi there — how can I help?")).toBe("Hi there, how can I help?");
    expect(plainPunctuation("Strong fit – apply today")).toBe("Strong fit, apply today");
  });

  it("keeps number ranges and list bullets readable", () => {
    expect(plainPunctuation("2019–2021, about 10 — 15%")).toBe("2019-2021, about 10-15%");
    expect(plainPunctuation("Options:\n— Resume\n  – Cover letter")).toBe("Options:\n- Resume\n  - Cover letter");
  });

  it("leaves ordinary text, hyphens and markdown alone", () => {
    const text = "A well-known role.\n\n- one\n- two\n\n**Bold** and `code`.";
    expect(plainPunctuation(text)).toBe(text);
    expect(plainPunctuation("That works —.")).toBe("That works.");
  });
});
