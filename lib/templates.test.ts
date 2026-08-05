import { describe, expect, it } from "vitest";
import { RANK_FREE, RANK_PLUS, RANK_PRO, RANK_STARTER } from "../convex/plans";
import {
  canUseResumeTemplate,
  getResumeTemplatesForRank,
  isValidResumeTemplateId,
  resumeTemplateMinRank,
} from "./templates";

describe("resumeTemplateMinRank", () => {
  it("places each template on its tier", () => {
    expect(resumeTemplateMinRank("jake")).toBe(RANK_FREE);
    expect(resumeTemplateMinRank("joseph")).toBe(RANK_STARTER);
    expect(resumeTemplateMinRank("mar")).toBe(RANK_PRO);
  });

  it("treats an unknown template as Pro rather than free", () => {
    expect(resumeTemplateMinRank("nonexistent")).toBe(RANK_PRO);
  });
});

describe("canUseResumeTemplate", () => {
  it("gives every rank Jake", () => {
    expect(canUseResumeTemplate("jake", RANK_FREE)).toBe(true);
    expect(canUseResumeTemplate("jake", RANK_PRO)).toBe(true);
  });

  it("locks Joseph to Starter and above", () => {
    expect(canUseResumeTemplate("joseph", RANK_FREE)).toBe(false);
    expect(canUseResumeTemplate("joseph", RANK_STARTER)).toBe(true);
    expect(canUseResumeTemplate("joseph", RANK_PLUS)).toBe(true);
  });

  it("locks Mar to Pro alone", () => {
    expect(canUseResumeTemplate("mar", RANK_STARTER)).toBe(false);
    expect(canUseResumeTemplate("mar", RANK_PLUS)).toBe(false);
    expect(canUseResumeTemplate("mar", RANK_PRO)).toBe(true);
  });
});

describe("getResumeTemplatesForRank", () => {
  it("returns only Jake for a free user", () => {
    expect(getResumeTemplatesForRank(RANK_FREE).map((t) => t.id)).toEqual(["jake"]);
  });

  it("returns Jake and Joseph for Starter and Plus", () => {
    expect(getResumeTemplatesForRank(RANK_STARTER).map((t) => t.id)).toEqual(["jake", "joseph"]);
    expect(getResumeTemplatesForRank(RANK_PLUS).map((t) => t.id)).toEqual(["jake", "joseph"]);
  });

  it("returns all three for Pro", () => {
    expect(getResumeTemplatesForRank(RANK_PRO).map((t) => t.id)).toEqual(["jake", "joseph", "mar"]);
  });
});

describe("isValidResumeTemplateId", () => {
  it("accepts the shipped templates and rejects anything else", () => {
    expect(isValidResumeTemplateId("jake")).toBe(true);
    expect(isValidResumeTemplateId("mar")).toBe(true);
    expect(isValidResumeTemplateId("vertex")).toBe(false);
  });
});
