import Resend from "@auth/core/providers/resend";

/**
 * Emails an 8-digit code for the Password provider's "reset" flow.
 *
 * Needs on the Convex deployment:
 *   AUTH_RESEND_KEY   Resend API key for a domain verified in Resend
 *   AUTH_RESEND_FROM  optional, defaults to JobKompass <noreply@myjobkompass.com>
 *
 * Calls the Resend REST API with fetch so the Convex bundle needs no extra dependency.
 */
export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 20,
  async generateVerificationToken() {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return String(bytes[0] % 100_000_000).padStart(8, "0");
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    if (!provider.apiKey) throw new Error("Password reset email is not configured");
    const from = process.env.AUTH_RESEND_FROM || "JobKompass <noreply@myjobkompass.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${token} is your JobKompass reset code`,
        text: `Your JobKompass password reset code is ${token}.\n\nIt works for 20 minutes. If you did not ask for this, you can ignore this email.`,
      }),
    });
    if (!res.ok) throw new Error("Could not send the reset email");
  },
});
