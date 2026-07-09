import { describe, expect, it } from "vitest";
import { isEligibleForFollowUp } from "./followUpEligibility";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const now = 1_720_000_000_000;

describe("isEligibleForFollowUp", () => {
  it("is eligible when sent more than 6 days ago with no follow-up yet", () => {
    expect(isEligibleForFollowUp({ status: "sent", sentAt: now - SIX_DAYS_MS - 1000 }, now)).toBe(true);
  });

  it("is not eligible when sent less than 6 days ago", () => {
    expect(isEligibleForFollowUp({ status: "sent", sentAt: now - 1000 }, now)).toBe(false);
  });

  it("is not eligible if a follow-up was already sent", () => {
    expect(
      isEligibleForFollowUp({ status: "sent", sentAt: now - SIX_DAYS_MS - 1000, followUpSentAt: now - 1000 }, now)
    ).toBe(false);
  });

  it("is not eligible for a lead that isn't in 'sent' status", () => {
    expect(isEligibleForFollowUp({ status: "pending_approval", sentAt: now - SIX_DAYS_MS - 1000 }, now)).toBe(false);
  });

  it("is not eligible if sentAt is missing", () => {
    expect(isEligibleForFollowUp({ status: "sent" }, now)).toBe(false);
  });
});
