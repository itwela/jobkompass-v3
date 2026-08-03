import { describe, expect, it } from "vitest";
import { resolveInitialTemplateId, templatePreferenceKey } from "./templatePreference";

const AVAILABLE = ["jake", "joseph", "mar"];

describe("templatePreferenceKey", () => {
  it("namespaces the key per document type", () => {
    expect(templatePreferenceKey("resume")).toBe("jk:lastTemplateId:resume");
    expect(templatePreferenceKey("cover-letter")).toBe("jk:lastTemplateId:cover-letter");
  });
});

describe("resolveInitialTemplateId", () => {
  it("restores a stored id that is still available", () => {
    expect(resolveInitialTemplateId("joseph", AVAILABLE, "jake")).toEqual({
      templateId: "joseph",
      wasRemembered: true,
    });
  });

  it("falls back when nothing is stored", () => {
    expect(resolveInitialTemplateId(null, AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back when storage is unavailable and undefined is passed", () => {
    expect(resolveInitialTemplateId(undefined, AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back for an id that was retired from the allowlist", () => {
    // `vertex` was one of the skeleton templates removed from RESUME_TEMPLATES.
    // A browser that stored it before removal must not resolve to it.
    expect(resolveInitialTemplateId("vertex", AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back for a garbage value", () => {
    expect(resolveInitialTemplateId("{}", AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("falls back for an empty string", () => {
    expect(resolveInitialTemplateId("", AVAILABLE, "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("handles a single-template list", () => {
    expect(resolveInitialTemplateId(null, ["jake"], "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });

  it("does not remember an id when the allowlist is empty", () => {
    expect(resolveInitialTemplateId("jake", [], "jake")).toEqual({
      templateId: "jake",
      wasRemembered: false,
    });
  });
});
