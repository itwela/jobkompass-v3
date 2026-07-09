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
    return NextResponse.redirect(new URL("/profile?gmail_error=config_error", request.url));
  }

  // Resolve the signed-in JobKompass user's identity the same way the rest of this app
  // authenticates server-side Convex calls from a Next.js route handler (see
  // app/api/jobs/add/route.ts, app/api/documents/generate-resume-pdf/route.ts):
  // convexAuthNextjsToken() reads the Convex Auth session for the current request, and
  // that token is attached to a ConvexHttpClient so subsequent calls run as that user.
  const convexToken = await convexAuthNextjsToken();
  if (!convexToken) {
    return NextResponse.redirect(new URL("/auth?redirect=/profile", request.url));
  }

  const convexClient = new ConvexHttpClient(convexUrl);
  convexClient.setAuth(convexToken);

  // saveTokens (convex/emailAccounts.ts) is an internalMutation and cannot be invoked
  // directly from an external Convex client. connectAccount is a thin public action
  // that runs it via ctx.runMutation. connectAccount resolves the acting user's own
  // convex_user_id itself (via api.auth.getConvexUserId, using the auth token set on
  // this ConvexHttpClient above) - it does not take a userId argument, so there is no
  // client-supplied identity to trust or forge here.
  await convexClient.action(api.emailAccounts.connectAccount, {
    email: userInfo.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expiry_date || Date.now() + 3600_000,
  });

  return NextResponse.redirect(new URL("/profile?gmail_connected=1", request.url));
}
