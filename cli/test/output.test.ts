import { describe, expect, it } from "vitest";
import { formatOutput, renderPretty } from "../src/output";

describe("renderPretty", () => {
  it("renders array of objects as aligned columns", () => {
    const out = renderPretty([
      { name: "rice", calories: 300 },
      { name: "chicken breast", calories: 220 },
    ]);
    expect(out).toContain("name");
    expect(out).toContain("chicken breast");
    expect(out.split("\n").length).toBeGreaterThanOrEqual(3); // header + 2 rows
  });
  it("renders plain object as key: value lines", () => {
    const out = renderPretty({ calories: 2400, protein: 180 });
    expect(out).toContain("calories: 2400");
  });
  it("renders scalars and null", () => {
    expect(renderPretty(null)).toBe("(none)");
    expect(renderPretty("done")).toBe("done");
  });
});

describe("formatOutput notice", () => {
  const data = { id: "r1", template: "jake", notice: "Your plan doesn't include mar; used jake instead. Upgrade to use it." };
  it("keeps notice in JSON mode", () => {
    expect(JSON.parse(formatOutput(data, true)).notice).toBe(data.notice);
  });
  it("prints the notice on its own first line in pretty mode", () => {
    const out = formatOutput(data, false);
    expect(out.split("\n")[0]).toBe(`Notice: ${data.notice}`);
    expect(out).toContain("template: jake");
    expect(out).not.toContain("notice: ");
  });
  it("is unchanged without a notice", () => {
    expect(formatOutput({ a: 1 }, false)).toBe(renderPretty({ a: 1 }));
  });
});
