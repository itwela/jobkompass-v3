import { describe, expect, it } from "vitest";
import { JOB_STATUSES, segmentWidths, statusKey } from "@/lib/jkStatus";

describe("segmentWidths", () => {
  it("returns percentages that sum to 100", () => {
    const w = segmentWidths([{ status: "Interested", count: 3 }, { status: "Applied", count: 5 }, { status: "Offered", count: 1 }]);
    expect(w.reduce((a, b) => a + b.width, 0)).toBeCloseTo(100, 6);
    expect(w.find((s) => s.status === "Applied")?.width).toBeCloseTo((5 / 9) * 100, 6);
  });
  it("gives a zero-count status zero width", () => {
    const w = segmentWidths([{ status: "Interested", count: 4 }, { status: "Ghosted", count: 0 }]);
    expect(w.find((s) => s.status === "Ghosted")?.width).toBe(0);
    expect(w.find((s) => s.status === "Interested")?.width).toBe(100);
  });
  it("returns all zeros for an empty list or all-zero counts", () => {
    expect(segmentWidths([])).toEqual([]);
    expect(segmentWidths([{ status: "Applied", count: 0 }]).every((s) => s.width === 0)).toBe(true);
  });
  it("ignores negative and non-finite counts", () => {
    const w = segmentWidths([{ status: "Applied", count: -2 }, { status: "Offered", count: Number.NaN }, { status: "Interested", count: 2 }]);
    expect(w.map((s) => s.width)).toEqual([0, 0, 100]);
  });
});

describe("statusKey", () => {
  it("maps every known status to its token", () => {
    for (const s of JOB_STATUSES) expect(statusKey(s)).toBe(s.toLowerCase());
  });
  it("is case-insensitive and falls back to ghosted for unknown values", () => {
    expect(statusKey("applied")).toBe("applied");
    expect(statusKey("Offer")).toBe("offered");
    expect(statusKey("something else")).toBe("ghosted");
    expect(statusKey(undefined)).toBe("ghosted");
  });
});
