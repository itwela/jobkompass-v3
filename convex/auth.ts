import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password()],
});

// For development/testing, you can also add other providers
// import { Google } from "@convex-dev/auth/providers/Google";
// providers: [Password(), Google()],
