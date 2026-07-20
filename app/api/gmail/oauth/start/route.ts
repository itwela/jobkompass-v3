import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  // When reconnecting a specific (revoked) account, the Settings "Reconnect" button passes
  // ?login_hint=<email> so Google pre-selects that exact address instead of making the user
  // pick from their account chooser. saveTokens upserts by (userId, email), so signing back
  // in with the same address refreshes the existing row's tokens and flips it back to active.
  const loginHint = request.nextUrl.searchParams.get("login_hint") || undefined;

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token on every connect, needed for multiple accounts
    login_hint: loginHint,
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });

  return NextResponse.redirect(url);
}
