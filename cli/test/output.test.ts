import { describe, expect, it } from "vitest";
import { renderPretty } from "../src/output";

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
