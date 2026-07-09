# Job Lead Email Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an always-on agent inside JobKompass that watches Itwela's Gmail accounts, classifies job-opportunity emails, drafts a tailored resume + reply for direct outreach (sent only after approval), follows up once, extracts individual listings from job-board digests, and mirrors all of it into a read-only feed on Life Dashboard.

**Architecture:** A Convex cron polls each connected Gmail account every 5 minutes via the Gmail API, classifies new messages with OpenRouter, and for direct outreach drafts a tailored resume (reusing JobKompass's existing LaTeX resume pipeline) and reply message pending approval; for digests it splits listings into individual leads with no reply step. A daily cron follows up once on unanswered sent leads. Every `jobLeads` write pushes a mirrored copy to a new read-only table in Life Dashboard's Convex deployment via an authenticated HTTP endpoint.

**Tech Stack:** Next.js 16 + Convex (jobkompass-v3), Convex (life-dashboard), Gmail API via `googleapis`, OpenRouter (`google/gemma-3-27b-it:free`, matching the existing `convex/extensionSaveJob.ts` pattern), the existing LaTeX resume-compilation service (`LATEX_SERVICE_URL`), vitest for pure-logic unit tests (matching `cli/test`'s existing convention).

## Global Constraints

- All new LLM calls (classification, extraction, resume tailoring, reply drafting) go through OpenRouter via direct `fetch` to `https://openrouter.ai/api/v1/chat/completions`, using `process.env.OPENROUTER_API_KEY` — never the Claude/Anthropic API, and never the `@openai/agents` SDK used elsewhere in this repo.
- Gmail access is via the official Gmail API with OAuth per account (not IMAP, not a forwarding alias), scopes `gmail.readonly` and `gmail.send` — must support 2+ of Itwela's own Gmail accounts.
- Any Convex file that imports `googleapis` (a Node-only package) must start with `"use node";` as its first line, per Convex's runtime requirements, and must live in its own action file separate from query/mutation-only files.
- `jobLeads` stays a table separate from the existing `jobs` table. Leads only ever become `jobs` rows through the explicit promote action — never automatically.
- No direct reply/send happens without an explicit approval step for `personal_outreach` leads. `digest_listing` leads never get a reply/send step at all.
- One follow-up maximum per lead, after ~6 days with no reply, itself gated by the same approval step.
- Life Dashboard's `jobLeads` table is read-only from the dashboard's own UI — all writes to it come only from the sync endpoint called by JobKompass.

---

## Task 1: Add dependencies and schema tables

**Files:**
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/package.json`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/schema.ts`

**Interfaces:**
- Produces: `emailAccounts` table (fields: `userId`, `email`, `accessToken`, `refreshToken`, `tokenExpiresAt`, `historyId`, `status`, `connectedAt`), indexed `by_user`.
- Produces: `jobLeads` table (fields: `userId`, `sourceAccountId`, `sourceType`, `company`, `role`, `senderEmail`, `rawSnippet`, `originalMessageId`, `rfcMessageId`, `threadId`, `status`, `draftResumeId`, `draftMessage`, `isFollowUp`, `approvedAt`, `sentAt`, `followUpSentAt`, `promotedAt`, `classificationError`, `createdAt`, `updatedAt`), indexed `by_user`, `by_status`, `by_user_and_status`.

- [ ] **Step 1: Add the `googleapis` dependency**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npm install googleapis
```
Expected: `package.json` gains a `"googleapis"` entry under `dependencies`, `package-lock.json` updates.

- [ ] **Step 2: Add `emailAccounts` and `jobLeads` to the schema**

Open `convex/schema.ts`. Find the `jobs: defineTable({ ... })` block (around line 90) and add the two new tables directly after it, inside the `defineSchema({ ... })` call:

```typescript
  emailAccounts: defineTable({
    userId: v.string(), // convex_user_id
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
    historyId: v.optional(v.string()), // Gmail checkpoint cursor; unset until first poll
    status: v.union(v.literal("active"), v.literal("revoked")),
    connectedAt: v.number(),
  }).index("by_user", ["userId"]),

  jobLeads: defineTable({
    userId: v.string(), // convex_user_id
    sourceAccountId: v.id("emailAccounts"),
    sourceType: v.union(v.literal("personal_outreach"), v.literal("digest_listing")),
    company: v.string(),
    role: v.string(),
    senderEmail: v.optional(v.string()),
    rawSnippet: v.string(),
    originalMessageId: v.string(), // Gmail internal message id
    rfcMessageId: v.optional(v.string()), // RFC Message-ID header, needed for In-Reply-To/References
    threadId: v.string(),
    status: v.union(
      v.literal("new"),
      v.literal("pending_approval"),
      v.literal("sent"),
      v.literal("followed_up"),
      v.literal("replied"),
      v.literal("closed"),
      v.literal("extracted"),
      v.literal("promoted")
    ),
    draftResumeId: v.optional(v.id("resumes")),
    draftMessage: v.optional(v.string()),
    isFollowUp: v.optional(v.boolean()),
    approvedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    followUpSentAt: v.optional(v.number()),
    promotedAt: v.optional(v.number()),
    classificationError: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"]),
```

- [ ] **Step 3: Verify the schema compiles**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx convex dev --once
```
Expected: output ends with `Convex functions ready!` and no schema validation errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add package.json package-lock.json convex/schema.ts
git commit -m "Add emailAccounts and jobLeads tables, googleapis dependency"
```

---

## Task 2: Gmail OAuth connect flow

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAccounts.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/app/api/gmail/oauth/start/route.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/app/api/gmail/oauth/callback/route.ts`

**Interfaces:**
- Consumes: `getAuthUserId(ctx)` from `@convex-dev/auth/server` (same pattern as `convex/extensionApiKeys.ts`).
- Produces: `internalMutation api.emailAccounts.saveTokens({ userId, email, accessToken, refreshToken, tokenExpiresAt }): Id<"emailAccounts">`, `query api.emailAccounts.list(): Array<{_id, email, status, connectedAt}>`, `mutation api.emailAccounts.disconnect({ accountId }): { success: true }`.

- [ ] **Step 1: Write `convex/emailAccounts.ts`**

```typescript
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const convexUserId = (user as any)?.convex_user_id || userId;

    const accounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    return accounts.map((a) => ({
      _id: a._id,
      email: a.email,
      status: a.status,
      connectedAt: a.connectedAt,
    }));
  },
});

export const disconnect = mutation({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    const convexUserId = (user as any)?.convex_user_id || userId;

    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== convexUserId) {
      throw new Error("Account not found");
    }
    await ctx.db.patch(args.accountId, { status: "revoked" as const });
    return { success: true };
  },
});

export const saveTokens = internalMutation({
  args: {
    userId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        status: "active" as const,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailAccounts", {
      userId: args.userId,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      status: "active" as const,
      connectedAt: Date.now(),
    });
  },
});

export const getActiveAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("emailAccounts")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

export const updateTokens = internalMutation({
  args: {
    accountId: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      accessToken: args.accessToken,
      tokenExpiresAt: args.tokenExpiresAt,
    });
  },
});

export const updateHistoryId = internalMutation({
  args: { accountId: v.id("emailAccounts"), historyId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, { historyId: args.historyId });
  },
});

export const markRevoked = internalMutation({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, { status: "revoked" as const });
  },
});
```

- [ ] **Step 2: Write the OAuth start route**

```typescript
// app/api/gmail/oauth/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token on every connect, needed for multiple accounts
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });

  return NextResponse.redirect(url);
}
```

- [ ] **Step 3: Write the OAuth callback route**

```typescript
// app/api/gmail/oauth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "@/convex/_generated/api";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { auth } from "@/convex/auth";

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

  const { userId } = await auth.getUserIdentity
    ? { userId: undefined }
    : { userId: undefined };

  // Resolve the signed-in JobKompass user's convex_user_id via a Convex query,
  // forwarding the request's auth cookie/token through fetchQuery's token option.
  const token = request.cookies.get("__convexAuthJWT")?.value;
  const currentUser: any = await fetchQuery(api.auth.getCurrentUser as any, {}, { token });
  const convexUserId = currentUser?.convex_user_id || currentUser?._id;
  if (!convexUserId) {
    return NextResponse.redirect(new URL("/auth?redirect=/profile", request.url));
  }

  await fetchMutation(
    internal.emailAccounts.saveTokens as any,
    {
      userId: convexUserId,
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expiry_date || Date.now() + 3600_000,
    },
    { token }
  );

  return NextResponse.redirect(new URL("/profile?gmail_connected=1", request.url));
}
```

Note: `api.auth.getCurrentUser` may not exist yet under that exact name — before writing this step, run `grep -n "getCurrentUser\|export const" convex/auth.ts` and use whichever existing query returns the signed-in user's `convex_user_id`. If none exists, add a minimal one to `convex/auth.ts` following the `getAuthUserId` pattern used throughout `convex/documents.ts`.

- [ ] **Step 4: Add the required environment variables**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
npx convex env set GOOGLE_CLIENT_ID "<from Google Cloud Console OAuth client>"
npx convex env set GOOGLE_CLIENT_SECRET "<from Google Cloud Console OAuth client>"
```
And add to `.env.local` (read by Next.js routes, not Convex):
```
GOOGLE_CLIENT_ID=<same value>
GOOGLE_CLIENT_SECRET=<same value>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/oauth/callback
```
Expected: `npx convex env list` shows both keys set.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, sign in, visit `http://localhost:3000/api/gmail/oauth/start`, complete Google's consent screen for one Gmail account, confirm redirect lands on `/profile?gmail_connected=1` and `npx convex dev` logs show no errors. Then in the Convex dashboard's data browser, confirm a new row exists in `emailAccounts` with `status: "active"`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add convex/emailAccounts.ts app/api/gmail/oauth/
git commit -m "Add Gmail OAuth connect flow and emailAccounts CRUD"
```

---

## Task 3: Gmail API client wrapper

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAgent/gmailClient.ts`

**Interfaces:**
- Consumes: an `emailAccounts` row shape (`accessToken`, `refreshToken`, `tokenExpiresAt`).
- Produces: `getGmailClient(account): Promise<{ gmail: gmail_v1.Gmail, refreshedAccessToken?: string, refreshedExpiresAt?: number }>`, `listNewMessageIds(gmail, sinceHistoryId?: string): Promise<{ messageIds: string[], newHistoryId: string }>`, `getMessage(gmail, messageId): Promise<{ id, threadId, rfcMessageId, from, subject, snippet, bodyText }>`, `sendReply(gmail, params): Promise<{ sentMessageId: string }>`.

- [ ] **Step 1: Write the client wrapper**

```typescript
// convex/emailAgent/gmailClient.ts
"use node";

import { google, gmail_v1 } from "googleapis";

type Account = {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
};

export async function getGmailClient(account: Account) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiresAt,
  });

  let refreshedAccessToken: string | undefined;
  let refreshedExpiresAt: number | undefined;

  if (account.tokenExpiresAt < Date.now() + 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    refreshedAccessToken = credentials.access_token ?? undefined;
    refreshedExpiresAt = credentials.expiry_date ?? undefined;
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return { gmail, refreshedAccessToken, refreshedExpiresAt };
}

export async function listNewMessageIds(
  gmail: gmail_v1.Gmail,
  sinceHistoryId?: string
): Promise<{ messageIds: string[]; newHistoryId: string }> {
  const profile = await gmail.users.getProfile({ userId: "me" });
  const newHistoryId = String(profile.data.historyId);

  if (!sinceHistoryId) {
    // First poll for this account: just grab recent inbox mail (last 14 days),
    // don't backfill from the dawn of time.
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "in:inbox newer_than:14d",
      maxResults: 50,
    });
    return { messageIds: (list.data.messages || []).map((m) => m.id!), newHistoryId };
  }

  const history = await gmail.users.history.list({
    userId: "me",
    startHistoryId: sinceHistoryId,
    historyTypes: ["messageAdded"],
  });

  const ids = new Set<string>();
  for (const record of history.data.history || []) {
    for (const added of record.messagesAdded || []) {
      if (added.message?.id) ids.add(added.message.id);
    }
  }
  return { messageIds: Array.from(ids), newHistoryId };
}

export async function getMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers || [];
  const header = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const bodyText = extractPlainText(res.data.payload);

  return {
    id: res.data.id!,
    threadId: res.data.threadId!,
    rfcMessageId: header("Message-ID"),
    from: header("From"),
    subject: header("Subject"),
    snippet: res.data.snippet || "",
    bodyText,
  };
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  for (const part of payload.parts || []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  return "";
}

export async function sendReply(
  gmail: gmail_v1.Gmail,
  params: {
    to: string;
    subject: string;
    bodyText: string;
    threadId: string;
    inReplyTo: string; // rfcMessageId of the original
    attachment?: { filename: string; content: Buffer; mimeType: string };
  }
): Promise<{ sentMessageId: string }> {
  const boundary = `boundary_${Date.now()}`;
  const subjectLine = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;

  let raw = "";
  raw += `To: ${params.to}\r\n`;
  raw += `Subject: ${subjectLine}\r\n`;
  raw += `In-Reply-To: ${params.inReplyTo}\r\n`;
  raw += `References: ${params.inReplyTo}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  raw += `--${boundary}\r\n`;
  raw += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
  raw += `${params.bodyText}\r\n\r\n`;

  if (params.attachment) {
    raw += `--${boundary}\r\n`;
    raw += `Content-Type: ${params.attachment.mimeType}; name="${params.attachment.filename}"\r\n`;
    raw += `Content-Disposition: attachment; filename="${params.attachment.filename}"\r\n`;
    raw += `Content-Transfer-Encoding: base64\r\n\r\n`;
    raw += `${params.attachment.content.toString("base64")}\r\n\r\n`;
  }
  raw += `--${boundary}--`;

  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage, threadId: params.threadId },
  });

  return { sentMessageId: res.data.id! };
}
```

- [ ] **Step 2: Manual verification**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx tsc --noEmit
```
Expected: no type errors from `convex/emailAgent/gmailClient.ts`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add convex/emailAgent/gmailClient.ts
git commit -m "Add Gmail API client wrapper for listing, reading, and sending mail"
```

---

## Task 4: OpenRouter email classification

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/lib/emailAgent/classify.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/lib/emailAgent/classify.test.ts`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/package.json`

**Interfaces:**
- Produces: `parseClassificationResponse(raw: string): ClassificationResult | null`, `classifyEmail(input: { subject: string; from: string; bodyText: string }): Promise<ClassificationResult | null>`, and the type:
```typescript
type ClassificationResult =
  | { type: "personal_outreach"; company: string; role: string; senderName: string }
  | { type: "digest"; listings: Array<{ company: string; role: string; link: string }> }
  | { type: "neither" };
```

- [ ] **Step 1: Add vitest to the root package for pure-logic tests**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npm install -D vitest
```
Then add to `package.json`'s `"scripts"` block:
```json
    "test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

```typescript
// lib/emailAgent/classify.test.ts
import { describe, expect, it } from "vitest";
import { parseClassificationResponse } from "./classify";

describe("parseClassificationResponse", () => {
  it("parses a personal outreach response", () => {
    const raw = JSON.stringify({
      type: "personal_outreach",
      company: "Acme Corp",
      role: "Senior Engineer",
      senderName: "Jane Recruiter",
    });
    expect(parseClassificationResponse(raw)).toEqual({
      type: "personal_outreach",
      company: "Acme Corp",
      role: "Senior Engineer",
      senderName: "Jane Recruiter",
    });
  });

  it("parses a digest response with multiple listings", () => {
    const raw = JSON.stringify({
      type: "digest",
      listings: [
        { company: "Acme Corp", role: "Backend Engineer", link: "https://example.com/1" },
        { company: "Widget Co", role: "Frontend Engineer", link: "https://example.com/2" },
      ],
    });
    expect(parseClassificationResponse(raw)).toEqual({
      type: "digest",
      listings: [
        { company: "Acme Corp", role: "Backend Engineer", link: "https://example.com/1" },
        { company: "Widget Co", role: "Frontend Engineer", link: "https://example.com/2" },
      ],
    });
  });

  it("strips markdown code fences before parsing", () => {
    const raw = '```json\n{"type":"neither"}\n```';
    expect(parseClassificationResponse(raw)).toEqual({ type: "neither" });
  });

  it("returns null for malformed JSON", () => {
    expect(parseClassificationResponse("not json at all")).toBeNull();
  });

  it("returns null for an unrecognized type value", () => {
    expect(parseClassificationResponse('{"type":"spam"}')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx vitest run lib/emailAgent/classify.test.ts`
Expected: FAIL with "Cannot find module './classify'" or similar.

- [ ] **Step 4: Write the implementation**

```typescript
// lib/emailAgent/classify.ts

export type ClassificationResult =
  | { type: "personal_outreach"; company: string; role: string; senderName: string }
  | { type: "digest"; listings: Array<{ company: string; role: string; link: string }> }
  | { type: "neither" };

const CLASSIFICATION_PROMPT = `You are a job-opportunity email classifier. Given an email's subject, sender, and body, classify it and extract structured data.

Return ONLY valid JSON matching exactly one of these shapes:

1. A direct, personal message from a specific person (recruiter, founder, hiring manager) about a specific role at a specific company:
{"type": "personal_outreach", "company": string, "role": string, "senderName": string}

2. An automated digest/alert bundling multiple job listings (e.g. LinkedIn or Indeed job alerts):
{"type": "digest", "listings": [{"company": string, "role": string, "link": string}, ...]}

3. Anything else (newsletters, receipts, unrelated mail, application status updates):
{"type": "neither"}

Rules:
- Only use "personal_outreach" for a message that reads like it was written by/for one specific person about one specific opportunity.
- For "digest", extract every listing you can find with its direct link.
- Respond with ONLY the JSON object, no explanation or markdown.`;

export function parseClassificationResponse(raw: string): ClassificationResult | null {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (parsed?.type === "personal_outreach" && parsed.company && parsed.role && parsed.senderName) {
    return {
      type: "personal_outreach",
      company: String(parsed.company),
      role: String(parsed.role),
      senderName: String(parsed.senderName),
    };
  }

  if (parsed?.type === "digest" && Array.isArray(parsed.listings)) {
    return {
      type: "digest",
      listings: parsed.listings
        .filter((l: any) => l && l.company && l.role)
        .map((l: any) => ({
          company: String(l.company),
          role: String(l.role),
          link: String(l.link || ""),
        })),
    };
  }

  if (parsed?.type === "neither") {
    return { type: "neither" };
  }

  return null;
}

export async function classifyEmail(input: {
  subject: string;
  from: string;
  bodyText: string;
}): Promise<ClassificationResult | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OpenRouter API key not configured on server");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://myjobkompass.com",
      "X-Title": "JobKompass Email Agent",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        {
          role: "user",
          content: `Subject: ${input.subject}\nFrom: ${input.from}\n\n${input.bodyText.substring(0, 8000)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseClassificationResponse(content);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx vitest run lib/emailAgent/classify.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add package.json package-lock.json lib/emailAgent/classify.ts lib/emailAgent/classify.test.ts
git commit -m "Add OpenRouter email classification with tested response parsing"
```

---

## Task 5: Poll cron — fetch, classify, store leads

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/jobLeads.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAgent/poll.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/crons.ts`

**Interfaces:**
- Consumes: `getGmailClient`, `listNewMessageIds`, `getMessage` from `./gmailClient`; `classifyEmail` from `@/lib/emailAgent/classify`; `internal.emailAccounts.getActiveAccounts`, `internal.emailAccounts.updateTokens`, `internal.emailAccounts.updateHistoryId`, `internal.emailAccounts.markRevoked`.
- Produces: `internalMutation api.jobLeads.insertLead(args): Id<"jobLeads">`, `query api.jobLeads.list({ status? }): jobLeads[]`, `internalAction api.emailAgent.poll.pollAllAccounts(): void` (cron target).

- [ ] **Step 1: Write `convex/jobLeads.ts` (mutations/queries used by polling and later tasks)**

```typescript
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function resolveConvexUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  return (user as any)?.convex_user_id || userId;
}

export const insertLead = internalMutation({
  args: {
    userId: v.string(),
    sourceAccountId: v.id("emailAccounts"),
    sourceType: v.union(v.literal("personal_outreach"), v.literal("digest_listing")),
    company: v.string(),
    role: v.string(),
    senderEmail: v.optional(v.string()),
    rawSnippet: v.string(),
    originalMessageId: v.string(),
    rfcMessageId: v.optional(v.string()),
    threadId: v.string(),
    status: v.union(v.literal("new"), v.literal("extracted")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("jobLeads", { ...args, createdAt: now, updatedAt: now });
  },
});

export const findByOriginalMessageId = internalQuery({
  args: { userId: v.string(), originalMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobLeads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("originalMessageId"), args.originalMessageId))
      .first();
  },
});

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    let q = ctx.db.query("jobLeads").withIndex("by_user_and_status", (idx) =>
      args.status ? idx.eq("userId", convexUserId).eq("status", args.status as any) : idx.eq("userId", convexUserId)
    );
    return await q.order("desc").collect();
  },
});

export const markClassificationError = internalMutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, { classificationError: true, updatedAt: Date.now() });
  },
});

export const findSentLeadByThreadId = internalQuery({
  args: { userId: v.string(), threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobLeads")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "sent"))
      .filter((q) => q.eq(q.field("threadId"), args.threadId))
      .first();
  },
});

export const markReplied = internalMutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, { status: "replied" as const, updatedAt: Date.now() });
  },
});
```

- [ ] **Step 2: Write the poll action**

```typescript
// convex/emailAgent/poll.ts
"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, listNewMessageIds, getMessage } from "./gmailClient";
import { classifyEmail } from "../../lib/emailAgent/classify";

export const pollAllAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.runQuery(internal.emailAccounts.getActiveAccounts, {});

    for (const account of accounts) {
      try {
        const { gmail, refreshedAccessToken, refreshedExpiresAt } = await getGmailClient(account);
        if (refreshedAccessToken && refreshedExpiresAt) {
          await ctx.runMutation(internal.emailAccounts.updateTokens, {
            accountId: account._id,
            accessToken: refreshedAccessToken,
            tokenExpiresAt: refreshedExpiresAt,
          });
        }

        const { messageIds, newHistoryId } = await listNewMessageIds(gmail, account.historyId);

        for (const messageId of messageIds) {
          const existing = await ctx.runQuery(internal.jobLeads.findByOriginalMessageId, {
            userId: account.userId,
            originalMessageId: messageId,
          });
          if (existing) continue; // dedupe re-delivered mail

          const message = await getMessage(gmail, messageId);

          // If this message landed in a thread we already sent a reply on, it's the
          // sender responding — mark that lead replied (so it's excluded from
          // follow-up eligibility) instead of treating it as a brand-new lead.
          const repliedToLead = await ctx.runQuery(internal.jobLeads.findSentLeadByThreadId, {
            userId: account.userId,
            threadId: message.threadId,
          });
          if (repliedToLead) {
            await ctx.runMutation(internal.jobLeads.markReplied, { leadId: repliedToLead._id });
            continue;
          }

          const classification = await classifyEmail({
            subject: message.subject,
            from: message.from,
            bodyText: message.bodyText,
          });

          if (!classification) {
            await ctx.runMutation(internal.jobLeads.insertLead, {
              userId: account.userId,
              sourceAccountId: account._id,
              sourceType: "personal_outreach",
              company: "Unknown",
              role: "Unknown",
              senderEmail: message.from,
              rawSnippet: message.snippet,
              originalMessageId: message.id,
              rfcMessageId: message.rfcMessageId,
              threadId: message.threadId,
              status: "new",
            }).then((leadId) => ctx.runMutation(internal.jobLeads.markClassificationError, { leadId }));
            continue;
          }

          if (classification.type === "neither") continue;

          if (classification.type === "personal_outreach") {
            const leadId = await ctx.runMutation(internal.jobLeads.insertLead, {
              userId: account.userId,
              sourceAccountId: account._id,
              sourceType: "personal_outreach",
              company: classification.company,
              role: classification.role,
              senderEmail: message.from,
              rawSnippet: message.snippet,
              originalMessageId: message.id,
              rfcMessageId: message.rfcMessageId,
              threadId: message.threadId,
              status: "new",
            });
            await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, { leadId });
          }

          if (classification.type === "digest") {
            for (const listing of classification.listings) {
              await ctx.runMutation(internal.jobLeads.insertLead, {
                userId: account.userId,
                sourceAccountId: account._id,
                sourceType: "digest_listing",
                company: listing.company,
                role: listing.role,
                rawSnippet: listing.link,
                originalMessageId: message.id,
                rfcMessageId: message.rfcMessageId,
                threadId: message.threadId,
                status: "extracted",
              });
            }
          }
        }

        await ctx.runMutation(internal.emailAccounts.updateHistoryId, {
          accountId: account._id,
          historyId: newHistoryId,
        });
      } catch (error: any) {
        if (error?.code === 401 || error?.message?.includes("invalid_grant")) {
          await ctx.runMutation(internal.emailAccounts.markRevoked, { accountId: account._id });
        }
        console.error(`Poll failed for account ${account.email}:`, error);
      }
    }
  },
});
```

Note: this references `internal.emailAgent.draft.draftForLead`, which Task 6 creates. Convex resolves `internal.*` references at deploy time, so this file will fail to typecheck until Task 6 exists — that's expected; do Task 6 immediately after this one, before deploying.

- [ ] **Step 3: Write the cron registration**

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll gmail accounts for job leads",
  { minutes: 5 },
  internal.emailAgent.poll.pollAllAccounts
);

export default crons;
```

- [ ] **Step 4: Commit (after Task 6 exists, so the deploy actually typechecks)**

Hold this commit until Task 6's `draft.ts` file exists — see Task 6's own commit step, which commits both together.

---

## Task 6: Resume tailoring and reply drafting

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/lib/emailAgent/draftMessage.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/lib/emailAgent/draftMessage.test.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAgent/draft.ts`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/jobLeads.ts`

**Interfaces:**
- Consumes: `api.documents.listResumes` (existing query), `generateResumeLatex` from `@/lib/resume/generators` (existing), `api.documents.generateUploadUrl` / `api.documents.saveGeneratedResumeWithFile` (existing).
- Produces: `parseDraftMessageResponse(raw: string): string | null`, `internalAction internal.emailAgent.draft.draftForLead({ leadId, isFollowUp? }): void`, `internalMutation api.jobLeads.attachDraft(args): void`.

- [ ] **Step 1: Write the failing test for the reply-message response parser**

```typescript
// lib/emailAgent/draftMessage.test.ts
import { describe, expect, it } from "vitest";
import { parseDraftMessageResponse } from "./draftMessage";

describe("parseDraftMessageResponse", () => {
  it("extracts message text from a plain response", () => {
    expect(parseDraftMessageResponse("Hi Jane, thanks for reaching out!")).toBe(
      "Hi Jane, thanks for reaching out!"
    );
  });

  it("strips a leading/trailing quote wrapper if present", () => {
    expect(parseDraftMessageResponse('"Hi Jane, thanks for reaching out!"')).toBe(
      "Hi Jane, thanks for reaching out!"
    );
  });

  it("returns null for an empty response", () => {
    expect(parseDraftMessageResponse("   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx vitest run lib/emailAgent/draftMessage.test.ts`
Expected: FAIL with "Cannot find module './draftMessage'".

- [ ] **Step 3: Write `lib/emailAgent/draftMessage.ts`**

```typescript
// lib/emailAgent/draftMessage.ts

export function parseDraftMessageResponse(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function draftReplyMessage(input: {
  senderName: string;
  company: string;
  role: string;
  originalSnippet: string;
  isFollowUp: boolean;
}): Promise<string | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OpenRouter API key not configured on server");

  const systemPrompt = input.isFollowUp
    ? `You write brief, polite one-paragraph follow-up emails from a job seeker to a recruiter/founder who has not responded in about a week. No subject line, no greeting formatting beyond "Hi <name>,", no sign-off beyond a first name. Reference the role and company naturally. Respond with ONLY the message text.`
    : `You write brief, warm, one-paragraph reply emails from a job seeker responding to a recruiter/founder's outreach about a specific role. Express genuine interest, mention the attached resume, and ask a natural next-step question. No subject line, "Hi <name>," greeting, sign off with just a first name placeholder "[Your name]". Respond with ONLY the message text.`;

  const userPrompt = `Sender: ${input.senderName}\nCompany: ${input.company}\nRole: ${input.role}\nOriginal message snippet: ${input.originalSnippet}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://myjobkompass.com",
      "X-Title": "JobKompass Email Agent",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 400,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseDraftMessageResponse(content);
}

export async function tailorResumeContent(input: {
  baseContent: any;
  company: string;
  role: string;
}): Promise<any | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OpenRouter API key not configured on server");

  const systemPrompt = `You tailor resume content for a specific job application. You will receive a JSON object representing a resume (personalInfo, experience, education, projects, skills, certifications, additionalInfo). Return a JSON object with the EXACT SAME shape and keys, but:
- Rewrite personalInfo.summary (if present) to emphasize fit for the target role/company.
- Within each experience item's "details" array, reorder bullets to put the most relevant ones first. Do not invent new bullets or change factual content (companies, titles, dates).
- Within skills, reorder to put the most relevant skills first. Do not add skills that aren't already present.
Respond with ONLY the JSON object, no explanation or markdown.`;

  const userPrompt = `Target company: ${input.company}\nTarget role: ${input.role}\n\nBase resume JSON:\n${JSON.stringify(input.baseContent)}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://myjobkompass.com",
      "X-Title": "JobKompass Email Agent",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx vitest run lib/emailAgent/draftMessage.test.ts`
Expected: PASS, 3 tests passing.

- [ ] **Step 5: Add `attachDraft` to `convex/jobLeads.ts`**

Append to `convex/jobLeads.ts`:

```typescript
export const attachDraft = internalMutation({
  args: {
    leadId: v.id("jobLeads"),
    draftResumeId: v.optional(v.id("resumes")),
    draftMessage: v.string(),
    isFollowUp: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      draftResumeId: args.draftResumeId,
      draftMessage: args.draftMessage,
      isFollowUp: args.isFollowUp,
      status: "pending_approval" as const,
      updatedAt: Date.now(),
    });
  },
});

export const getById = internalQuery({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => await ctx.db.get(args.leadId),
});
```

- [ ] **Step 6: Write `convex/emailAgent/draft.ts`**

```typescript
// convex/emailAgent/draft.ts
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { tailorResumeContent, draftReplyMessage } from "../../lib/emailAgent/draftMessage";
import { generateResumeLatex } from "../../lib/resume/generators";

export const draftForLead = internalAction({
  args: { leadId: v.id("jobLeads"), isFollowUp: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    const isFollowUp = args.isFollowUp ?? false;
    let draftResumeId: string | undefined;

    if (!isFollowUp) {
      const resumes: any[] = await ctx.runQuery(internal.documents.listResumesInternal, {
        userId: lead.userId,
      });
      const baseResume = resumes.find((r) => r.isActive) || resumes[0];

      if (baseResume?.content) {
        const tailored = await tailorResumeContent({
          baseContent: baseResume.content,
          company: lead.company,
          role: lead.role,
        });

        if (tailored) {
          const latexTemplate = generateResumeLatex(tailored, baseResume.template || "jake");
          const LATEX_SERVICE_URL =
            process.env.NODE_ENV === "development" ? "http://127.0.0.1:8080" : process.env.LATEX_SERVICE_URL;

          if (LATEX_SERVICE_URL) {
            const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latex: latexTemplate, filename: `resume-${lead._id}` }),
            });

            if (compileResponse.ok) {
              const { pdfBase64 } = await compileResponse.json();
              if (pdfBase64) {
                const pdfBuffer = Buffer.from(pdfBase64, "base64");
                const uploadUrl: string = await ctx.runMutation(internal.documents.generateUploadUrlInternal, {});
                const uploadResponse = await fetch(uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/pdf" },
                  body: new Uint8Array(pdfBuffer),
                });
                if (uploadResponse.ok) {
                  const { storageId } = await uploadResponse.json();
                  draftResumeId = await ctx.runMutation(internal.documents.saveGeneratedResumeInternal, {
                    userId: lead.userId,
                    name: `${lead.company} - ${lead.role} (tailored)`,
                    fileId: storageId,
                    fileName: `resume-${lead.company}-${Date.now()}.pdf`,
                    fileSize: pdfBuffer.length,
                    content: tailored,
                    template: baseResume.template || "jake",
                  });
                }
              }
            }
          }
        }
      }
    }

    const message = await draftReplyMessage({
      senderName: lead.senderEmail || "there",
      company: lead.company,
      role: lead.role,
      originalSnippet: lead.rawSnippet,
      isFollowUp,
    });

    await ctx.runMutation(internal.jobLeads.attachDraft, {
      leadId: args.leadId,
      draftResumeId: draftResumeId as any,
      draftMessage: message || "Thanks for reaching out — I'd love to learn more about this opportunity.",
      isFollowUp,
    });
  },
});
```

Note: this calls `internal.documents.listResumesInternal`, `internal.documents.generateUploadUrlInternal`, and `internal.documents.saveGeneratedResumeInternal` — internal counterparts to the existing public `listResumes`/`generateUploadUrl`/`saveGeneratedResumeWithFile` mutations in `convex/documents.ts`, needed because this runs from a cron with no authenticated user session. Before writing this step, check whether `convex/documents.ts` already has internal variants; if not, add them as thin wrappers that take `userId` explicitly instead of calling `getAuthUserId`, following the exact pattern `convex/jobs.ts` already uses for `add` (public, auth-derived) vs. `addInternal` (internal, explicit `userId`).

- [ ] **Step 7: Manual verification**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx convex dev --once
```
Expected: no schema/type errors; `internal.emailAgent.draft.draftForLead` and `internal.emailAgent.poll.pollAllAccounts` both resolve.

- [ ] **Step 8: Commit (Tasks 5 and 6 together, since Task 5 references Task 6's function)**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add convex/jobLeads.ts convex/emailAgent/poll.ts convex/emailAgent/draft.ts convex/crons.ts \
  lib/emailAgent/draftMessage.ts lib/emailAgent/draftMessage.test.ts convex/documents.ts
git commit -m "Add Gmail polling cron, classification wiring, and resume/reply drafting"
```

---

## Task 7: Approval queue — send on approve

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAgent/send.ts`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/jobLeads.ts`

**Interfaces:**
- Consumes: `sendReply` from `./gmailClient`, `getGmailClient` from `./gmailClient`.
- Produces: `mutation api.jobLeads.approve({ leadId }): void`, `mutation api.jobLeads.reject({ leadId }): void`, `mutation api.jobLeads.editDraft({ leadId, draftMessage }): void`, `internalAction internal.emailAgent.send.sendApprovedLead({ leadId }): void`.

- [ ] **Step 1: Add approve/reject/edit mutations to `convex/jobLeads.ts`**

```typescript
export const approve = mutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    if (lead.status !== "pending_approval") throw new Error("Lead is not pending approval");

    await ctx.db.patch(args.leadId, { approvedAt: Date.now(), updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.emailAgent.send.sendApprovedLead, { leadId: args.leadId });
  },
});

export const reject = mutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    await ctx.db.patch(args.leadId, { status: "closed" as const, updatedAt: Date.now() });
  },
});

export const editDraft = mutation({
  args: { leadId: v.id("jobLeads"), draftMessage: v.string() },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    await ctx.db.patch(args.leadId, { draftMessage: args.draftMessage, updatedAt: Date.now() });
  },
});

export const markSent = internalMutation({
  args: { leadId: v.id("jobLeads"), isFollowUp: v.boolean() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.leadId, {
      status: args.isFollowUp ? ("followed_up" as const) : ("sent" as const),
      sentAt: now,
      followUpSentAt: args.isFollowUp ? now : undefined,
      updatedAt: now,
    });
  },
});

export const markSendError = internalMutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    // Stays pending_approval; leaves approvedAt set so a distinct "approved but failed to send"
    // state is visible if a UI wants to show a retry affordance later.
    await ctx.db.patch(args.leadId, { updatedAt: Date.now() });
  },
});
```

Add `import { internal } from "./_generated/api";` to the top of `convex/jobLeads.ts` alongside the existing imports.

- [ ] **Step 2: Write `convex/emailAgent/send.ts`**

```typescript
// convex/emailAgent/send.ts
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, sendReply } from "./gmailClient";

export const sendApprovedLead = internalAction({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    try {
      const account: any = await ctx.runQuery(internal.emailAccounts.getById, {
        accountId: lead.sourceAccountId,
      });
      const { gmail } = await getGmailClient(account);

      let attachment: { filename: string; content: Buffer; mimeType: string } | undefined;
      if (lead.draftResumeId) {
        const resumeFile: any = await ctx.runQuery(internal.documents.getResumeFileInternal, {
          resumeId: lead.draftResumeId,
        });
        if (resumeFile?.url) {
          const fileRes = await fetch(resumeFile.url);
          const buffer = Buffer.from(await fileRes.arrayBuffer());
          attachment = { filename: resumeFile.fileName || "resume.pdf", content: buffer, mimeType: "application/pdf" };
        }
      }

      const senderEmailMatch = lead.senderEmail?.match(/<(.+)>/);
      const toAddress = senderEmailMatch ? senderEmailMatch[1] : lead.senderEmail;

      await sendReply(gmail, {
        to: toAddress,
        subject: `${lead.company} - ${lead.role}`,
        bodyText: lead.draftMessage,
        threadId: lead.threadId,
        inReplyTo: lead.rfcMessageId || "",
        attachment,
      });

      await ctx.runMutation(internal.jobLeads.markSent, { leadId: args.leadId, isFollowUp: !!lead.isFollowUp });
    } catch (error) {
      console.error(`Failed to send lead ${args.leadId}:`, error);
      await ctx.runMutation(internal.jobLeads.markSendError, { leadId: args.leadId });
    }
  },
});
```

Note: this references `internal.emailAccounts.getById` and `internal.documents.getResumeFileInternal` — add `getById` as a one-line `internalQuery` to `convex/emailAccounts.ts` (`return await ctx.db.get(args.accountId)`), and check `convex/documents.ts`'s existing `getFileUrlById` query for the pattern to follow for an internal variant returning `{ url, fileName }`.

- [ ] **Step 3: Manual verification**

With one Gmail account connected and at least one `pending_approval` lead (trigger by sending yourself a test outreach-style email and waiting for the next 5-minute poll), call `api.jobLeads.approve` from the Convex dashboard's function runner with that lead's `_id`. Confirm: the Gmail thread shows a new reply with the resume attached, and the lead's `status` becomes `"sent"` in the data browser.

- [ ] **Step 4: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add convex/jobLeads.ts convex/emailAgent/send.ts convex/emailAccounts.ts convex/documents.ts
git commit -m "Add approval queue actions and Gmail send-on-approve"
```

---

## Task 8: Approval queue UI

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/app/jk-components/jkEmailLeads/ApprovalQueue.tsx`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/app/jk-components/jkEmailLeads/LeadsList.tsx`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/app/leads/page.tsx`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/app/jk-components/jkSIdebar.tsx`

**Interfaces:**
- Consumes: `api.jobLeads.list`, `api.jobLeads.approve`, `api.jobLeads.reject`, `api.jobLeads.editDraft` (Task 6/7), `useQuery`/`useMutation` from `convex/react` (existing pattern — check any existing `jk-components` file for the exact import, e.g. `jkPricing.tsx`).

- [ ] **Step 1: Check the existing Convex-React usage pattern**

Run: `grep -n "useQuery\|useMutation\|from \"convex/react\"" app/jk-components/jkSIdebar.tsx | head -10`
Use whatever import path and hook style this shows verbatim in the new components below (the code below assumes the standard `convex/react` `useQuery`/`useMutation` hooks; adjust only if this repo wraps them differently).

- [ ] **Step 2: Write `ApprovalQueue.tsx`**

```tsx
// app/jk-components/jkEmailLeads/ApprovalQueue.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function ApprovalQueue() {
  const leads = useQuery(api.jobLeads.list, { status: "pending_approval" });
  const approve = useMutation(api.jobLeads.approve);
  const reject = useMutation(api.jobLeads.reject);
  const editDraft = useMutation(api.jobLeads.editDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  if (leads === undefined) return <div>Loading...</div>;
  if (leads.length === 0) return <div className="text-sm text-muted-foreground">No drafts waiting for approval.</div>;

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <div key={lead._id} className="border rounded-lg p-4 space-y-2">
          <div className="font-medium">
            {lead.company} — {lead.role} {lead.isFollowUp && <span className="text-xs text-muted-foreground">(follow-up)</span>}
          </div>
          <div className="text-xs text-muted-foreground">{lead.senderEmail}</div>
          {editingId === lead._id ? (
            <textarea
              className="w-full border rounded p-2 text-sm"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{lead.draftMessage}</p>
          )}
          <div className="flex gap-2">
            {editingId === lead._id ? (
              <button
                className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground"
                onClick={async () => {
                  await editDraft({ leadId: lead._id, draftMessage: draftText });
                  setEditingId(null);
                }}
              >
                Save
              </button>
            ) : (
              <button
                className="text-sm px-3 py-1 rounded border"
                onClick={() => {
                  setEditingId(lead._id);
                  setDraftText(lead.draftMessage || "");
                }}
              >
                Edit
              </button>
            )}
            <button
              className="text-sm px-3 py-1 rounded bg-green-600 text-white"
              onClick={() => approve({ leadId: lead._id })}
            >
              Approve & Send
            </button>
            <button
              className="text-sm px-3 py-1 rounded bg-red-600 text-white"
              onClick={() => reject({ leadId: lead._id })}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `LeadsList.tsx`**

```tsx
// app/jk-components/jkEmailLeads/LeadsList.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function LeadsList() {
  const leads = useQuery(api.jobLeads.list, {});
  const promote = useMutation(api.jobLeads.promoteToJob);

  if (leads === undefined) return <div>Loading...</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Company</th>
          <th>Role</th>
          <th>Source</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead._id} className="border-b">
            <td className="py-2">{lead.company}</td>
            <td>{lead.role}</td>
            <td>{lead.sourceType === "digest_listing" ? "Digest" : "Direct outreach"}</td>
            <td>{lead.status}</td>
            <td>
              {lead.status !== "promoted" && (
                <button
                  className="text-xs px-2 py-1 rounded border"
                  onClick={() => promote({ leadId: lead._id })}
                >
                  Promote to Jobs
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Note: `api.jobLeads.promoteToJob` is added in Task 9 — this component will fail to typecheck until then; write Task 9 immediately after this step, before running `npx tsc --noEmit`.

- [ ] **Step 4: Write the page and add a sidebar link**

```tsx
// app/leads/page.tsx
import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue";
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList";

export default function LeadsPage() {
  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Pending Approval</h2>
        <ApprovalQueue />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">All Leads</h2>
        <LeadsList />
      </section>
    </div>
  );
}
```

Check `app/jk-components/jkSIdebar.tsx` for how existing nav links are structured (look for an array of `{ label, href, icon }` or similar) and add one entry pointing at `/leads`, matching that exact structure — do not guess the shape; read the file first.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, visit `/leads`, confirm the page loads without console errors and (once Task 9 exists) shows any test leads created during Task 7's manual verification.

- [ ] **Step 6: Commit (after Task 9, since `LeadsList.tsx` depends on `promoteToJob`)**

Hold this commit until Task 9 is done — commit both together there.

---

## Task 9: Promote-to-jobs mutation

**Files:**
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/jobLeads.ts`

**Interfaces:**
- Consumes: `internal.jobs.addInternal` (existing, from `convex/jobs.ts:301`).
- Produces: `mutation api.jobLeads.promoteToJob({ leadId }): Id<"jobs">`.

- [ ] **Step 1: Add the promote mutation**

Append to `convex/jobLeads.ts`:

```typescript
export const promoteToJob = mutation({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== convexUserId) throw new Error("Lead not found");
    if (lead.status === "promoted") throw new Error("Lead already promoted");

    const jobId = await ctx.runMutation(internal.jobs.addInternal, {
      userId: convexUserId,
      company: lead.company,
      title: lead.role,
      link: lead.rawSnippet.startsWith("http") ? lead.rawSnippet : "",
      status: "Interested",
      resumeUsed: lead.draftResumeId ? String(lead.draftResumeId) : undefined,
    });

    await ctx.db.patch(args.leadId, { status: "promoted" as const, promotedAt: Date.now(), updatedAt: Date.now() });
    return jobId;
  },
});
```

- [ ] **Step 2: Manual verification**

Run `npx convex dev --once`, then from the Convex dashboard function runner call `jobLeads:promoteToJob` with an existing lead's `_id`. Confirm a new row appears in the `jobs` table with matching company/title and status `"Interested"`, and the lead's own status becomes `"promoted"`.

- [ ] **Step 3: Commit (Tasks 8 and 9 together)**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add convex/jobLeads.ts app/jk-components/jkEmailLeads/ app/leads/page.tsx app/jk-components/jkSIdebar.tsx
git commit -m "Add promote-to-jobs mutation and approval queue / leads list UI"
```

---

## Task 10: Follow-up cron

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/lib/emailAgent/followUpEligibility.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/lib/emailAgent/followUpEligibility.test.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAgent/followUp.ts`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/jobLeads.ts`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/crons.ts`

**Interfaces:**
- Produces: `isEligibleForFollowUp(lead: { status: string; sentAt?: number; followUpSentAt?: number }, now: number): boolean`, `internalQuery api.jobLeads.getSentLeads(): jobLeads[]`, `internalAction internal.emailAgent.followUp.checkFollowUps(): void` (cron target).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/emailAgent/followUpEligibility.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx vitest run lib/emailAgent/followUpEligibility.test.ts`
Expected: FAIL with "Cannot find module './followUpEligibility'".

- [ ] **Step 3: Write the implementation**

```typescript
// lib/emailAgent/followUpEligibility.ts

const FOLLOW_UP_DELAY_MS = 6 * 24 * 60 * 60 * 1000;

export function isEligibleForFollowUp(
  lead: { status: string; sentAt?: number; followUpSentAt?: number },
  now: number
): boolean {
  if (lead.status !== "sent") return false;
  if (lead.followUpSentAt) return false;
  if (!lead.sentAt) return false;
  return now - lead.sentAt >= FOLLOW_UP_DELAY_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3" && npx vitest run lib/emailAgent/followUpEligibility.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Add `getSentLeads` to `convex/jobLeads.ts`**

```typescript
export const getSentLeads = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jobLeads")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();
  },
});
```

- [ ] **Step 6: Write `convex/emailAgent/followUp.ts`**

```typescript
// convex/emailAgent/followUp.ts
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { isEligibleForFollowUp } from "../../lib/emailAgent/followUpEligibility";

export const checkFollowUps = internalAction({
  args: {},
  handler: async (ctx) => {
    const sentLeads = await ctx.runQuery(internal.jobLeads.getSentLeads, {});
    const now = Date.now();

    for (const lead of sentLeads) {
      if (isEligibleForFollowUp(lead, now)) {
        await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, {
          leadId: lead._id,
          isFollowUp: true,
        });
      }
    }
  },
});
```

- [ ] **Step 7: Register the cron**

Add to `convex/crons.ts`, before `export default crons;`:

```typescript
crons.daily(
  "check job leads for follow-up",
  { hourUTC: 14, minuteUTC: 0 }, // ~9am Eastern
  internal.emailAgent.followUp.checkFollowUps
);
```

- [ ] **Step 8: Manual verification**

Run `npx convex dev --once`, confirm no errors. In the dashboard data browser, manually set a test lead's `status` to `"sent"` and `sentAt` to `Date.now() - 7 * 24 * 60 * 60 * 1000`, then invoke `emailAgent/followUp:checkFollowUps` from the function runner. Confirm the lead moves to `status: "pending_approval"` with `isFollowUp: true` and a new `draftMessage`.

- [ ] **Step 9: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add lib/emailAgent/followUpEligibility.ts lib/emailAgent/followUpEligibility.test.ts \
  convex/emailAgent/followUp.ts convex/jobLeads.ts convex/crons.ts
git commit -m "Add daily follow-up cron with tested eligibility logic"
```

---

## Task 11: Life Dashboard mirror table and sync endpoint

**Files:**
- Modify: `/Users/itwelaibomu/Desktop/Code/life-dashboard/convex/schema.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/life-dashboard/convex/jobLeads.ts`
- Create: `/Users/itwelaibomu/Desktop/Code/life-dashboard/convex/http.ts`

**Interfaces:**
- Produces (life-dashboard): `internalMutation api.jobLeads.upsertFromSync(args): void`, `query api.jobLeads.list(): jobLeads[]`, HTTP endpoint `POST /jobLeads/sync`.

- [ ] **Step 1: Add the mirror table to Life Dashboard's schema**

Open `/Users/itwelaibomu/Desktop/Code/life-dashboard/convex/schema.ts` and add, inside `defineSchema({ ... })`:

```typescript
  jobLeads: defineTable({
    sourceLeadId: v.string(), // the jobLeads _id from jobkompass-v3, used as the upsert key
    company: v.string(),
    role: v.string(),
    sourceType: v.union(v.literal("personal_outreach"), v.literal("digest_listing")),
    status: v.string(),
    isFollowUp: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_source_lead", ["sourceLeadId"]),
```

- [ ] **Step 2: Write `convex/jobLeads.ts`**

```typescript
// convex/jobLeads.ts (life-dashboard)
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const upsertFromSync = internalMutation({
  args: {
    sourceLeadId: v.string(),
    company: v.string(),
    role: v.string(),
    sourceType: v.union(v.literal("personal_outreach"), v.literal("digest_listing")),
    status: v.string(),
    isFollowUp: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobLeads")
      .withIndex("by_source_lead", (q) => q.eq("sourceLeadId", args.sourceLeadId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("jobLeads", { ...args, updatedAt: now });
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobLeads").collect();
  },
});
```

- [ ] **Step 3: Write `convex/http.ts`**

```typescript
// convex/http.ts (life-dashboard)
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/jobLeads/sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const syncKey = request.headers.get("X-Sync-Key");
    if (!syncKey || syncKey !== process.env.JOB_LEADS_SYNC_KEY) {
      return new Response(JSON.stringify({ success: false, error: "Invalid sync key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { sourceLeadId, company, role, sourceType, status, isFollowUp } = body;

    if (!sourceLeadId || !company || !role || !sourceType || !status) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(internal.jobLeads.upsertFromSync, {
      sourceLeadId,
      company,
      role,
      sourceType,
      status,
      isFollowUp,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

- [ ] **Step 4: Set the shared secret**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/life-dashboard"
npx convex env set JOB_LEADS_SYNC_KEY "<generate with: openssl rand -hex 32>"
```
Record the same value for use in Task 12 (JobKompass side needs the identical key).

- [ ] **Step 5: Manual verification**

Run `npx convex dev --once` in `life-dashboard`, then:
```bash
curl -X POST "$(cat .env.local | grep NEXT_PUBLIC_CONVEX_URL | cut -d= -f2 | sed 's#.cloud#.site#')/jobLeads/sync" \
  -H "Content-Type: application/json" \
  -H "X-Sync-Key: <the key from Step 4>" \
  -d '{"sourceLeadId":"test123","company":"Acme","role":"Engineer","sourceType":"personal_outreach","status":"sent"}'
```
Expected: `{"success":true}`, and a new row visible in the Convex dashboard's `jobLeads` table for `life-dashboard`.

Note: Convex HTTP actions are served from the `.convex.site` domain, not `.convex.cloud` — confirm this by checking the URL Convex prints when running `npx convex dev` (it logs both).

- [ ] **Step 6: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/life-dashboard"
git add convex/schema.ts convex/jobLeads.ts convex/http.ts
git commit -m "Add read-only jobLeads mirror table and authenticated sync endpoint"
```

---

## Task 12: Push leads from JobKompass to Life Dashboard

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/emailAgent/mirror.ts`
- Modify: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/convex/jobLeads.ts`

**Interfaces:**
- Produces: `internalAction internal.emailAgent.mirror.pushLead({ leadId }): void`, called after every status-changing mutation in `convex/jobLeads.ts` (`insertLead`, `attachDraft`, `markSent`, `promoteToJob`, `reject`).

- [ ] **Step 1: Write `convex/emailAgent/mirror.ts`**

```typescript
// convex/emailAgent/mirror.ts
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const pushLead = internalAction({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    const syncUrl = process.env.LIFE_DASHBOARD_SYNC_URL;
    const syncKey = process.env.LIFE_DASHBOARD_SYNC_KEY;
    if (!syncUrl || !syncKey) {
      console.error("Life Dashboard sync not configured (missing LIFE_DASHBOARD_SYNC_URL/KEY)");
      return;
    }

    try {
      await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sync-Key": syncKey },
        body: JSON.stringify({
          sourceLeadId: String(lead._id),
          company: lead.company,
          role: lead.role,
          sourceType: lead.sourceType,
          status: lead.status,
          isFollowUp: lead.isFollowUp,
        }),
      });
    } catch (error) {
      console.error(`Failed to mirror lead ${args.leadId} to Life Dashboard:`, error);
    }
  },
});
```

- [ ] **Step 2: Wire the push into every status-changing mutation**

In `convex/jobLeads.ts`, add `await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId: <id> });` as the last line before each `return`/end of handler in: `insertLead` (use the inserted id), `attachDraft`, `markSent`, `reject`, `promoteToJob`. For example, `insertLead` becomes:

```typescript
export const insertLead = internalMutation({
  args: { /* ...unchanged... */ },
  handler: async (ctx, args) => {
    const now = Date.now();
    const leadId = await ctx.db.insert("jobLeads", { ...args, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.emailAgent.mirror.pushLead, { leadId });
    return leadId;
  },
});
```

Apply the same one-line addition (using each function's own lead id in scope) to `attachDraft`, `markSent`, `reject`, and `promoteToJob`.

- [ ] **Step 3: Set the JobKompass-side env vars**

Run:
```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
npx convex env set LIFE_DASHBOARD_SYNC_URL "https://<life-dashboard-convex-deployment>.convex.site/jobLeads/sync"
npx convex env set LIFE_DASHBOARD_SYNC_KEY "<same key set in Task 11 Step 4>"
```

- [ ] **Step 4: Manual verification**

From the JobKompass Convex dashboard, invoke `jobLeads:insertLead` (internal, so use the function runner) with test data. Confirm the corresponding row appears in Life Dashboard's `jobLeads` table within a few seconds.

- [ ] **Step 5: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
git add convex/emailAgent/mirror.ts convex/jobLeads.ts
git commit -m "Mirror jobLeads writes to Life Dashboard via authenticated sync endpoint"
```

---

## Task 13: Life Dashboard feed UI

**Files:**
- Create: `/Users/itwelaibomu/Desktop/Code/life-dashboard/components/JobLeadsFeed.tsx`
- Modify: a main dashboard page under `/Users/itwelaibomu/Desktop/Code/life-dashboard/app/` (identify the exact file in Step 1)

**Interfaces:**
- Consumes: `api.jobLeads.list` (Task 11).

- [ ] **Step 1: Identify where existing dashboard cards are composed**

Run: `grep -rl "getAccounts\|getTransactions" "/Users/itwelaibomu/Desktop/Code/life-dashboard/app" --include="*.tsx"` to find the page that already renders finance/todo cards, so the new feed matches that page's layout convention.

- [ ] **Step 2: Write `JobLeadsFeed.tsx`**

```tsx
// components/JobLeadsFeed.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function JobLeadsFeed() {
  const leads = useQuery(api.jobLeads.list, {});

  if (leads === undefined) return <div>Loading...</div>;
  if (leads.length === 0) return <div className="text-sm text-muted-foreground">No job leads yet.</div>;

  const sorted = [...leads].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-2">
      {sorted.slice(0, 20).map((lead) => (
        <div key={lead._id} className="flex justify-between text-sm border-b py-1">
          <span>
            {lead.company} — {lead.role}
          </span>
          <span className="text-muted-foreground">{lead.status}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add the card to the dashboard page**

Import `JobLeadsFeed` into the file identified in Step 1 and render it alongside the existing cards, following that file's existing card-wrapper markup (e.g. whatever `<div className="...">` wrapper the finance/todo cards already use — match it exactly rather than introducing a new style).

- [ ] **Step 4: Manual verification**

Run `npm run dev` in `life-dashboard`, visit the dashboard page, confirm the job leads feed renders the test rows created in Task 12's verification step.

- [ ] **Step 5: Commit**

```bash
cd "/Users/itwelaibomu/Desktop/Code/life-dashboard"
git add components/JobLeadsFeed.tsx app/
git commit -m "Add read-only job leads feed to the dashboard"
```

---

## Task 14: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Connect a second Gmail account**

Repeat Task 2 Step 5's manual flow for a second Gmail account. Confirm two `active` rows exist in `emailAccounts`.

- [ ] **Step 2: Send yourself two test emails**

From an external account, send one email that reads like direct recruiter outreach (mentions a specific company and role, personal tone) and one that reads like a multi-listing digest, to one of the connected accounts.

- [ ] **Step 3: Wait for the next poll cycle (up to 5 minutes) and verify**

- The outreach email produces a `jobLeads` row with `sourceType: "personal_outreach"`, eventually `status: "pending_approval"` with a `draftMessage` and (if a resume exists) a `draftResumeId`.
- The digest email produces one `jobLeads` row per listing with `sourceType: "digest_listing"`, `status: "extracted"`.
- Both rows are visible on `/leads` in JobKompass and mirrored into Life Dashboard's feed.

- [ ] **Step 4: Approve the outreach lead and confirm delivery**

Click Approve in the `/leads` UI. Confirm the original Gmail thread (in whichever account received it) shows a reply with the resume attached, and the lead's dashboard status updates to `"sent"` in both JobKompass and the Life Dashboard mirror.

- [ ] **Step 5: Promote the digest lead**

Click "Promote to Jobs" on the digest-derived lead. Confirm a new row appears in JobKompass's existing `/jobs` (or wherever the jobs tracker UI lives) with status `"Interested"`, and the lead itself shows `status: "promoted"`.
