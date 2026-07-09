import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/profile?gmail_error=missing_code", request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(new URL("/profile?gmail_error=no_refresh_token", request.url));
  }
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
  const { data: userInfo } = await oauth2.userinfo.get();
  if (!userInfo.email) {
    return NextResponse.redirect(new URL("/profile?gmail_error=no_email", request.url));
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL not configured");
  }

  // Resolve the signed-in JobKompass user's convex_user_id the same way the rest of
  // this app authenticates server-side Convex calls from a Next.js route handler (see
  // app/api/jobs/add/route.ts, app/api/documents/generate-resume-pdf/route.ts):
  // convexAuthNextjsToken() reads the Convex Auth session for the current request, and
  // that token is attached to a ConvexHttpClient so subsequent calls run as that user.
  // auth.getConvexUserId (convex/auth.ts) is the existing query that resolves
  // getAuthUserId(ctx) -> users row -> convex_user_id, falling back to the raw userId
  // if convex_user_id hasn't been backfilled yet - the same fallback used throughout
  // convex/auth.ts and convex/extensionApiKeys.ts.
  const convexToken = await convexAuthNextjsToken();
  if (!convexToken) {
    return NextResponse.redirect(new URL("/auth?redirect=/profile", request.url));
  }

  const convexClient = new ConvexHttpClient(convexUrl);
  convexClient.setAuth(convexToken);

  const convexUserId = await convexClient.query(api.auth.getConvexUserId, {});
  if (!convexUserId) {
    return NextResponse.redirect(new URL("/auth?redirect=/profile", request.url));
  }

  // saveTokens (convex/emailAccounts.ts) is an internalMutation and cannot be invoked
  // directly from an external Convex client. connectAccount is a thin public action
  // that runs it via ctx.runMutation, now that the caller's identity has been verified
  // above via the user's own Convex Auth token.
  await convexClient.action(api.emailAccounts.connectAccount, {
    userId: convexUserId as string,
    email: userInfo.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expiry_date || Date.now() + 3600_000,
  });

  return NextResponse.redirect(new URL("/profile?gmail_connected=1", request.url));
}
