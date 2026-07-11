import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
 
export default convexAuthNextjsMiddleware();

export const config = {
  // Runs middleware on all routes except static assets and the Gmail OAuth
  // routes. /api/gmail/oauth must be excluded because convexAuthNextjsMiddleware
  // intercepts any GET request carrying a ?code= param (Accept: text/html),
  // treats it as its own OAuth/magic-link code exchange, strips the code, and
  // redirects — which ate Google's authorization code before the Gmail callback
  // could run (gmail_error=missing_code) and cleared the session cookies.
  matcher: [
    "/((?!.*\\..*|_next|api/gmail/oauth).*)",
    "/",
    "/api/((?!gmail/oauth).*)",
    "/trpc(.*)",
  ],
};
