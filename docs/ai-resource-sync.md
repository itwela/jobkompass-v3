# AI Resource Saving Guide

This guide explains how the JobKompass chat experience now saves resources directly to the signed-in user's account using Convex auth.

## Overview

When the assistant decides to preserve a link or note, it calls the `addResourceToLibrary` tool. The tool writes into the authenticated user's `resources` table via Convex. Authentication is derived from the session token that Next.js exposes on the server.

Similarly, when the assistant needs to save a job opportunity, it invokes the `addJobToTracker` tool. This uses the same authenticated Convex client and writes to the `jobs` table with the user's session context.

The flow relies on the same auth primitives Convex documents for functions ([docs.convex.dev/auth/functions-auth](https://docs.convex.dev/auth/functions-auth)).

## Request Flow

1. A user submits a chat message to `POST /api/chat`.
2. The route handler fetches the Convex deployment URL from `CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL`.
3. `convexAuthNextjsToken()` returns the JWT for the current user (or `undefined` if anonymous).
4. A request-scoped `ConvexHttpClient` is created and, if a token exists, `setAuth(token)` is called.
5. The chat handler instantiates a fresh `Agent` for this request, wiring in:
   - the existing resume-generation tool,
   - a tool created via `createAddToResourcesTool(() => convexClient)`, and
   - a tool created via `createAddToJobsTool(() => convexClient)`.
6. `run(agent, history, …)` executes the conversation. Whenever the AI invokes `addResourceToLibrary`, the tool uses the provided Convex client to call `api.resources.add`. When the AI invokes `addJobToTracker`, the tool calls `api.jobs.add`.
7. Inside `convex/resources.ts` (and `convex/jobs.ts`), `ctx.auth.getUserIdentity()` and `getOrCreateUsername` ensure each write is scoped to the authenticated user. If no identity is present, the mutation throws `Not authenticated`, which propagates back to the tool result.

The critical detail is that the Convex client passed to the tool shares the user's auth context; no user IDs need to be guessed or exposed to the AI.

## Tool Implementation Highlights

- `createAddToResourcesTool` and `createAddToJobsTool` generate tools bound to a Convex client factory.
- Each tool lazily resolves the client (so tokens are up to date) and invokes `api.resources.add` / `api.jobs.add`.
- Authentication failures surface as friendly tool responses (`"Please sign in to save resources..."`), letting the assistant inform the user.
- The tool no longer touches `localStorage` or fetches profiles—everything trusts the token.

## Server Helper Utilities

`lib/serverResourceHelpers.ts` exposes `createServerConvexClient` so other server routes can spin up authenticated clients the same way. The helper methods (`serverAddResource`, `serverUpdateResource`, `serverDeleteResource`) now require callers to pass that client, ensuring every write runs under the current user's session.

## Debugging Tips

- Verify `CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL` are set—otherwise the handler throws early.
- If the tool reports a not-authenticated error, confirm the user is signed in and that `convexAuthNextjsToken()` returns a value on the server.
- Keep `convex/resources.ts` checking `ctx.auth.getUserIdentity()`; that's the enforcement gate Convex recommends.

With this structure, the AI can safely and reliably add resources for the active user without any manual token plumbing on the client.

