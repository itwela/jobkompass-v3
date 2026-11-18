import { describe, expect, it } from "vitest";
import { describeResumeChanges } from "./resumeChanges";

const base: any = {
  experience: [{ company: "Acme", details: ["Built search", "Fixed billing"] }],
  projects: [{ name: "CLI", description: "A CLI", details: ["Wrote parser", "Shipped v1"] }],
};

describe("describeResumeChanges bullets", () => {
  it("says reordered when the same bullets moved", () => {
    const tailored: any = {
      experience: [{ company: "Acme", details: ["Fixed billing", "Built search"] }],
      projects: [{ name: "CLI", description: "A CLI", details: ["Shipped v1", "Wrote parser"] }],
    };
    const { changes, marks } = describeResumeChanges(base, tailored, { role: "SWE" });
    expect(changes.map((c) => c.note)).toEqual(["The most relevant Acme work on top", "The most relevant work on top"]);
    expect(marks.experience).toEqual([0]);
    expect(marks.projects).toEqual([0]);
  });

  it("says rewritten when bullet text changed", () => {
    const tailored: any = {
      experience: [{ company: "Acme", details: ["Built search used by 2k people", "Fixed billing"] }],
      projects: [{ name: "CLI", description: "A CLI", details: ["Wrote a parser in Rust", "Shipped v1"] }],
    };
    const { changes } = describeResumeChanges(base, tailored, { role: "SWE" });
    expect(changes.map((c) => c.note)).toEqual(["Acme bullets rewritten for SWE", "Described for this role"]);
  });

  it("says nothing when nothing changed", () => {
    expect(describeResumeChanges(base, base, { role: "SWE" }).changes).toEqual([]);
  });
});
