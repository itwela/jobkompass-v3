/**
 * Who a sign-in belongs to, decided before Convex Auth creates an account.
 *
 * Convex Auth's default only links accounts that share a VERIFIED email, and a
 * password account's email is never verified, so without this a password user
 * who clicks "Continue with Google" would land in a brand-new empty account.
 *
 * The rule:
 *  - A known account signs in as itself.
 *  - Google, with an email Google has verified, joins the existing user that has
 *    that email (Google has proven the person owns the inbox).
 *  - Anything else that collides with an existing email is refused. Without this a
 *    stranger could sign up with a password for someone's Google-only email and
 *    get into their account.
 *  - Otherwise a new user is created.
 */
export type LinkDecision =
  | { kind: "existing"; userId: string }
  | { kind: "link"; userId: string }
  | { kind: "refuse" }
  | { kind: "create" };

export function decideLink(args: {
  existingUserId: string | null;
  type: string;
  emailVerified: boolean;
  userWithSameEmail: string | null;
}): LinkDecision {
  if (args.existingUserId) return { kind: "existing", userId: args.existingUserId };
  if (args.userWithSameEmail) {
    if (args.type === "oauth" && args.emailVerified) return { kind: "link", userId: args.userWithSameEmail };
    // Email/phone verification and reset flows always arrive with existingUserId.
    return { kind: "refuse" };
  }
  return { kind: "create" };
}

export const EMAIL_TAKEN_MESSAGE = "An account with this email already exists. Sign in instead.";
