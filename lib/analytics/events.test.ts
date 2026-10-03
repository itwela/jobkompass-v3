import { describe, expect, it } from "vitest";
import {
  buildFirstResumeProperties,
  buildPaidConversionProperties,
  buildResumeExportedProperties,
  buildSignupProperties,
  buildUpgradeClickedProperties,
} from "./events";

describe("analytics event properties", () => {
  it("signup carries only the auth method", () => {
    expect(buildSignupProperties()).toEqual({ method: "password" });
  });

  it("first resume created is a boolean plus a source slug, never a document", () => {
    expect(
      buildFirstResumeProperties({
        source: "upload",
        template_id: "jake",
      })
    ).toEqual({ is_first: true, source: "upload", template_id: "jake" });

    const dropped = buildFirstResumeProperties({
      source: "Ada Lovelace resume text",
      template_id: "not-a-template",
    });
    expect(dropped).toEqual({ is_first: true, source: "in_app" });
    expect(JSON.stringify(dropped)).not.toContain("Ada");
  });

  it("resume export keeps method, format, and template id", () => {
    expect(buildResumeExportedProperties({ method: "download", template_id: "joseph" })).toEqual({
      method: "download",
      format: "pdf",
      template_id: "joseph",
    });
    expect(buildResumeExportedProperties({ method: "print" })).toBeNull();
  });

  it("upgrade click and paid conversion keep plan slugs only", () => {
    expect(
      buildUpgradeClickedProperties({
        surface: "pricing",
        plan_id: "plus-annual",
        interval: "year",
        authenticated: false,
      })
    ).toEqual({
      surface: "pricing",
      plan_id: "plus-annual",
      interval: "year",
      authenticated: false,
    });
    expect(
      buildUpgradeClickedProperties({
        surface: "not-a-surface",
        plan_id: "plus",
        authenticated: true,
      })
    ).toBeNull();
    expect(
      buildPaidConversionProperties({ plan_id: "pro", interval: "month" })
    ).toEqual({ source: "checkout_success", plan_id: "pro", interval: "month" });
    expect(buildPaidConversionProperties({ plan_id: "cus_secret", interval: "weekly" })).toEqual({
      source: "checkout_success",
    });
  });
});
