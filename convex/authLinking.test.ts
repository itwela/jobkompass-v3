import { describe, expect, it } from "vitest";
import { decideLink } from "./authLinking";

describe("decideLink", () => {
  it("signs a known account in as itself", () => {
    expect(decideLink({ existingUserId: "u1", type: "oauth", emailVerified: false, userWithSameEmail: "u2" }))
      .toEqual({ kind: "existing", userId: "u1" });
  });

  it("joins Google to the password account with the same verified email", () => {
    expect(decideLink({ existingUserId: null, type: "oauth", emailVerified: true, userWithSameEmail: "u2" }))
      .toEqual({ kind: "link", userId: "u2" });
  });

  it("refuses Google when Google has not verified the email", () => {
    expect(decideLink({ existingUserId: null, type: "oauth", emailVerified: false, userWithSameEmail: "u2" }))
      .toEqual({ kind: "refuse" });
  });

  it("refuses a password sign-up for an email that already has an account", () => {
    expect(decideLink({ existingUserId: null, type: "credentials", emailVerified: false, userWithSameEmail: "u2" }))
      .toEqual({ kind: "refuse" });
  });

  it("creates a user for a new email", () => {
    expect(decideLink({ existingUserId: null, type: "credentials", emailVerified: false, userWithSameEmail: null }))
      .toEqual({ kind: "create" });
    expect(decideLink({ existingUserId: null, type: "oauth", emailVerified: true, userWithSameEmail: null }))
      .toEqual({ kind: "create" });
  });
});
