# Manual "Add lead from email" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user type a sender's email address in Job Leads, pick from that sender's 3 most recent messages, and run the picked one through the existing draft → tailor-resume → approve/send pipeline.

**Architecture:** Pure, testable helpers live in `lib/emailAgent/manualLead.ts` (vitest). Gmail I/O and Convex orchestration live in `convex/` node actions that call those helpers and reuse the existing `insertLead` + `draftForLead` machinery. Two thin session-authed public actions in `convex/jobLeads.ts` bridge the UI. UI is a panel added to the existing Leads chat-window mode.

**Tech Stack:** Convex (actions/mutations/queries), `googleapis` Gmail v1, React/Next, vitest.

## Global Constraints

- Live deployment is Convex `dev:proficient-mammoth-632` (NOT the prod slot). Deploy with `CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once`. Chase every push with `npx vercel --prod` (auto-deploy is unreliable).
- Multi-user app. New public functions MUST resolve the user via `resolveConvexUserId(ctx)` and MUST NOT accept a `userId` argument from the client.
- Anything fs/node-dependent (Gmail via `googleapis`) must live in a `"use node"` Convex module; pure logic must NOT, so vitest can import it.
- Leads render as a chat-window MODE (`jkChatWindow-LeadsMode.tsx`), not the `app/leads` route. UI goes in the mode component.
- Test runner: `vitest run` (config-less; tests co-located as `*.test.ts`).

---

### Task 1: Pure helpers (company-from-email, force-to-lead, merge-top-3)

**Files:**
- Create: `lib/emailAgent/manualLead.ts`
- Test: `lib/emailAgent/manualLead.test.ts`

**Interfaces:**
- Consumes: `Classification` type from `lib/emailAgent/classify.ts` (`{ type: "personal_outreach"; company; role; senderName } | { type: "digest"; listings } | { type: "neither" }`).
- Produces:
  - `companyFromEmail(senderEmail: string): string`
  - `resolveLeadFields(classification: Classification | null, senderEmail: string): { company: string; role: string }`
  - `type SenderHit = { accountId: string; accountEmail: string; messageId: string; threadId: string; subject: string; snippet: string; receivedAt: number; rfcMessageId: string }`
  - `mergeTopMessages(perAccount: SenderHit[][], max?: number): SenderHit[]` (default max 3)

- [ ] **Step 1: Write the failing test**

```ts
// lib/emailAgent/manualLead.test.ts
import { describe, it, expect } from "vitest";
import { companyFromEmail, resolveLeadFields, mergeTopMessages, type SenderHit } from "./manualLead";

describe("companyFromEmail", () => {
  it("titlecases the domain's second-level label", () => {
    expect(companyFromEmail("jane@acme-corp.com")).toBe("Acme-corp");
    expect(companyFromEmail("recruiter@google.com")).toBe("Google");
  });
  it("falls back for junk input", () => {
    expect(companyFromEmail("not-an-email")).toBe("Unknown company");
  });
});

describe("resolveLeadFields", () => {
  it("uses classifier company/role when personal_outreach", () => {
    expect(
      resolveLeadFields({ type: "personal_outreach", company: "Acme", role: "SWE", senderName: "Jane" }, "j@acme.com")
    ).toEqual({ company: "Acme", role: "SWE" });
  });
  it("forces a lead from domain when classifier says neither", () => {
    expect(resolveLeadFields({ type: "neither" }, "j@acme.com")).toEqual({ company: "Acme", role: "Unknown role" });
  });
  it("forces a lead when classifier failed (null)", () => {
    expect(resolveLeadFields(null, "j@acme.com")).toEqual({ company: "Acme", role: "Unknown role" });
  });
});

describe("mergeTopMessages", () => {
  const hit = (id: string, receivedAt: number): SenderHit => ({
    accountId: "a", accountEmail: "me@x.com", messageId: id, threadId: "t", subject: "s", snippet: "sn", receivedAt, rfcMessageId: "<r>",
  });
  it("merges accounts, sorts newest-first, caps at 3", () => {
    const out = mergeTopMessages([[hit("1", 100), hit("2", 300)], [hit("3", 200), hit("4", 400)]]);
    expect(out.map((h) => h.messageId)).toEqual(["4", "2", "3"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && npx vitest run lib/emailAgent/manualLead.test.ts`
Expected: FAIL — cannot find module `./manualLead`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/emailAgent/manualLead.ts
import type { Classification } from "./classify";

export type SenderHit = {
  accountId: string;
  accountEmail: string;
  messageId: string;
  threadId: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  rfcMessageId: string;
};

export function companyFromEmail(senderEmail: string): string {
  const domain = senderEmail.split("@")[1];
  if (!domain || !domain.includes(".")) return "Unknown company";
  const label = domain.split(".").slice(-2, -1)[0];
  if (!label) return "Unknown company";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function resolveLeadFields(
  classification: Classification | null,
  senderEmail: string
): { company: string; role: string } {
  if (classification && classification.type === "personal_outreach") {
    return { company: classification.company, role: classification.role };
  }
  return { company: companyFromEmail(senderEmail), role: "Unknown role" };
}

export function mergeTopMessages(perAccount: SenderHit[][], max = 3): SenderHit[] {
  return perAccount
    .flat()
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, max);
}
```

Note: `Classification` is a union that is NOT exported yet from `classify.ts`. If the import fails, first add `export` to the `type Classification =` declaration at the top of `lib/emailAgent/classify.ts` (it is currently a local `type`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && npx vitest run lib/emailAgent/manualLead.test.ts`
Expected: PASS (all 6 assertions).

- [ ] **Step 5: Commit**

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
git add lib/emailAgent/manualLead.ts lib/emailAgent/manualLead.test.ts lib/emailAgent/classify.ts
git commit -m "feat(leads): pure helpers for manual lead-from-email"
```

---

### Task 2: Gmail search-by-sender helper

**Files:**
- Modify: `convex/emailAgent/gmailClient.ts` (add export)
- Test: `convex/emailAgent/gmailClient.searchFrom.test.ts`

**Interfaces:**
- Consumes: `gmail_v1.Gmail` (passed in), existing `getMessage(gmail, id)`.
- Produces: `searchMessagesFromSender(gmail: gmail_v1.Gmail, senderEmail: string, max?: number): Promise<Array<{ messageId: string; threadId: string; subject: string; snippet: string; receivedAt: number; rfcMessageId: string }>>` (default max 3).

- [ ] **Step 1: Write the failing test**

```ts
// convex/emailAgent/gmailClient.searchFrom.test.ts
import { describe, it, expect, vi } from "vitest";
import { searchMessagesFromSender } from "./gmailClient";

function fakeGmail() {
  return {
    users: {
      messages: {
        list: vi.fn().mockResolvedValue({ data: { messages: [{ id: "m1" }, { id: "m2" }] } }),
        get: vi.fn().mockImplementation(({ id }: { id: string }) => ({
          data: {
            id, threadId: "t-" + id, snippet: "snippet " + id, internalDate: id === "m1" ? "200" : "100",
            payload: { headers: [ { name: "Subject", value: "Sub " + id }, { name: "Message-ID", value: "<" + id + ">" } ] },
          },
        })),
      },
    },
  } as any;
}

describe("searchMessagesFromSender", () => {
  it("queries from:<sender> capped at max and maps fields", async () => {
    const gmail = fakeGmail();
    const out = await searchMessagesFromSender(gmail, "jane@acme.com", 3);
    expect(gmail.users.messages.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "me", q: "from:jane@acme.com", maxResults: 3 })
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ messageId: "m1", subject: "Sub m1", receivedAt: 200, rfcMessageId: "<m1>" });
  });
  it("returns [] when no messages", async () => {
    const gmail = fakeGmail();
    gmail.users.messages.list.mockResolvedValueOnce({ data: {} });
    expect(await searchMessagesFromSender(gmail, "x@y.com")).toEqual([]);
  });
}
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && npx vitest run convex/emailAgent/gmailClient.searchFrom.test.ts`
Expected: FAIL — `searchMessagesFromSender` is not exported.

- [ ] **Step 3: Write minimal implementation** (add to `convex/emailAgent/gmailClient.ts`, after `getMessage`)

```ts
export async function searchMessagesFromSender(
  gmail: gmail_v1.Gmail,
  senderEmail: string,
  max = 3
) {
  const list = await gmail.users.messages.list({
    userId: "me",
    q: `from:${senderEmail}`,
    maxResults: max,
  });
  const ids = (list.data.messages || []).map((m) => m.id!).filter(Boolean);
  const full = await Promise.all(ids.map((id) => getMessage(gmail, id)));
  return full.map((m) => ({
    messageId: m.id,
    threadId: m.threadId,
    subject: m.subject,
    snippet: m.snippet,
    receivedAt: m.receivedAt ?? 0,
    rfcMessageId: m.rfcMessageId,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && npx vitest run convex/emailAgent/gmailClient.searchFrom.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
git add convex/emailAgent/gmailClient.ts convex/emailAgent/gmailClient.searchFrom.test.ts
git commit -m "feat(leads): Gmail search-by-sender helper (top N)"
```

---

### Task 3: Convex node action — search sender across accounts

**Files:**
- Create: `convex/emailAgent/manualLead.ts` (`"use node"`)

**Interfaces:**
- Consumes: `emailAccounts.getActiveAccountsForUser({ userId })` (internalQuery, returns active `emailAccounts` rows with `accessToken/refreshToken/tokenExpiresAt/emailAddress/_id`), `getGmailClient`, `searchMessagesFromSender`, `emailAccounts.updateTokens`, `emailAccounts.markRevoked`, `mergeTopMessages`, `SenderHit`.
- Produces: `searchSenderMessagesInternal` internalAction: args `{ userId: string, senderEmail: string }` → returns `SenderHit[]` (≤3).

- [ ] **Step 1: Write the implementation**

```ts
// convex/emailAgent/manualLead.ts
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGmailClient, searchMessagesFromSender } from "./gmailClient";
import { mergeTopMessages, type SenderHit } from "../../lib/emailAgent/manualLead";

export const searchSenderMessagesInternal = internalAction({
  args: { userId: v.string(), senderEmail: v.string() },
  handler: async (ctx, { userId, senderEmail }): Promise<SenderHit[]> => {
    const accounts = await ctx.runQuery(internal.emailAccounts.getActiveAccountsForUser, { userId });
    const perAccount: SenderHit[][] = [];
    for (const account of accounts) {
      try {
        const { gmail, refreshedAccessToken, refreshedExpiresAt } = await getGmailClient(account);
        if (refreshedAccessToken && refreshedExpiresAt) {
          await ctx.runMutation(internal.emailAccounts.updateTokens, {
            accountId: account._id, accessToken: refreshedAccessToken, tokenExpiresAt: refreshedExpiresAt,
          });
        }
        const hits = await searchMessagesFromSender(gmail, senderEmail, 3);
        perAccount.push(
          hits.map((h) => ({ ...h, accountId: account._id as string, accountEmail: account.emailAddress }))
        );
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.includes("invalid_grant") || msg.includes("401")) {
          await ctx.runMutation(internal.emailAccounts.markRevoked, { accountId: account._id });
        }
      }
    }
    return mergeTopMessages(perAccount, 3);
  },
});
```

Note: confirm the account row's address field name — grep `emailAddress` in `convex/schema.ts`; if the field is named differently (e.g. `email`), use that name in the `accountEmail` mapping.

- [ ] **Step 2: Typecheck / codegen**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once`
Expected: compiles, `_generated/api` now includes `internal.emailAgent.manualLead.searchSenderMessagesInternal`.

- [ ] **Step 3: Live verify against a real sender**

Run (replace with a real userId + sender that exists in a connected inbox):
```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex run emailAgent/manualLead:searchSenderMessagesInternal \
  '{"userId":"k97f05pqn1sfbsz42ddxp24ayh7tmssa","senderEmail":"<real-sender@domain.com>"}'
```
Expected: JSON array of ≤3 objects with `messageId`, `subject`, `accountEmail`, `receivedAt`.

- [ ] **Step 4: Commit**

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
git add convex/emailAgent/manualLead.ts
git commit -m "feat(leads): action to search a sender's recent messages across inboxes"
```

---

### Task 4: Convex node action — ingest the selected message into the pipeline

**Files:**
- Modify: `convex/emailAgent/manualLead.ts` (add second action)

**Interfaces:**
- Consumes: `emailAccounts.getById({ accountId })`, `getGmailClient`, `getMessage`, `classifyEmail` (from `../../lib/emailAgent/classify`), `resolveLeadFields`, `jobLeads.findByOriginalMessageId({ userId, originalMessageId })`, `jobLeads.insertLead`, `internal.emailAgent.draft.draftForLead`.
- Produces: `ingestSelectedMessageInternal` internalAction: args `{ userId, accountId, messageId }` → `{ leadId: string | null, duplicate: boolean }`.

- [ ] **Step 1: Write the implementation** (append to `convex/emailAgent/manualLead.ts`)

```ts
import { getMessage } from "./gmailClient";
import { classifyEmail } from "../../lib/emailAgent/classify";
import { resolveLeadFields } from "../../lib/emailAgent/manualLead";

export const ingestSelectedMessageInternal = internalAction({
  args: { userId: v.string(), accountId: v.id("emailAccounts"), messageId: v.string() },
  handler: async (ctx, { userId, accountId, messageId }): Promise<{ leadId: string | null; duplicate: boolean }> => {
    const account = await ctx.runQuery(internal.emailAccounts.getById, { accountId });
    if (!account) throw new Error("Account not found");

    const existing = await ctx.runQuery(internal.jobLeads.findByOriginalMessageId, {
      userId, originalMessageId: messageId,
    });
    if (existing) return { leadId: existing._id as string, duplicate: true };

    const { gmail, refreshedAccessToken, refreshedExpiresAt } = await getGmailClient(account);
    if (refreshedAccessToken && refreshedExpiresAt) {
      await ctx.runMutation(internal.emailAccounts.updateTokens, {
        accountId, accessToken: refreshedAccessToken, tokenExpiresAt: refreshedExpiresAt,
      });
    }
    const msg = await getMessage(gmail, messageId);
    const senderEmail = (msg.from.match(/<([^>]+)>/)?.[1] ?? msg.from).trim();

    const classification = await classifyEmail({ from: msg.from, subject: msg.subject, body: msg.bodyText });
    const { company, role } = resolveLeadFields(classification, senderEmail);

    const leadId = await ctx.runMutation(internal.jobLeads.insertLead, {
      userId,
      sourceAccountId: accountId,
      sourceType: "personal_outreach",
      company,
      role,
      senderEmail,
      rawSnippet: msg.snippet,
      originalMessageId: msg.id,
      rfcMessageId: msg.rfcMessageId,
      threadId: msg.threadId,
      status: "new",
      emailReceivedAt: msg.receivedAt,
    });
    await ctx.scheduler.runAfter(0, internal.emailAgent.draft.draftForLead, { leadId });
    return { leadId: leadId as string, duplicate: false };
  },
});
```

Note: confirm `classifyEmail`'s argument shape by reading its signature in `lib/emailAgent/classify.ts` (it may take `{ from, subject, body }` or positional args); match it exactly. `getMessage` returns `{ id, threadId, rfcMessageId, from, subject, snippet, bodyText, receivedAt }` — verified.

- [ ] **Step 2: Typecheck / codegen**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once`
Expected: compiles clean.

- [ ] **Step 3: Live verify** — ingest a real message id from Task 3's output:

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex run emailAgent/manualLead:ingestSelectedMessageInternal \
  '{"userId":"k97f05pqn1sfbsz42ddxp24ayh7tmssa","accountId":"<accountId>","messageId":"<messageId>"}'
```
Expected: `{ leadId: "...", duplicate: false }`; the lead appears in the approval queue, and within ~seconds a draft + tailored resume attach (check `jobLeads:listAllInternal`). Run the same command again → `{ duplicate: true }`, no second lead.

- [ ] **Step 4: Commit**

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
git add convex/emailAgent/manualLead.ts
git commit -m "feat(leads): ingest a chosen message into the draft pipeline (dedupe + force-to-lead)"
```

---

### Task 5: Session-authed public wrappers

**Files:**
- Modify: `convex/jobLeads.ts` (add two `action`s near the existing public fns)

**Interfaces:**
- Consumes: `resolveConvexUserId(ctx)` (existing local fn, jobLeads.ts:7), the two internal actions from Tasks 3–4.
- Produces:
  - `searchSenderForManualLead` action: args `{ senderEmail: string }` → `SenderHit[]`.
  - `addManualLeadFromMessage` action: args `{ accountId: Id<"emailAccounts">, messageId: string }` → `{ leadId, duplicate }`.

- [ ] **Step 1: Write the implementation** (add to `convex/jobLeads.ts`; ensure `action` is imported from `./_generated/server` and `internal` from `./_generated/api`)

```ts
export const searchSenderForManualLead = action({
  args: { senderEmail: v.string() },
  handler: async (ctx, { senderEmail }) => {
    const userId = await resolveConvexUserId(ctx);
    return await ctx.runAction(internal.emailAgent.manualLead.searchSenderMessagesInternal, { userId, senderEmail });
  },
});

export const addManualLeadFromMessage = action({
  args: { accountId: v.id("emailAccounts"), messageId: v.string() },
  handler: async (ctx, { accountId, messageId }) => {
    const userId = await resolveConvexUserId(ctx);
    return await ctx.runAction(internal.emailAgent.manualLead.ingestSelectedMessageInternal, { userId, accountId, messageId });
  },
});
```

Note: `resolveConvexUserId` currently runs in query/mutation ctx. Confirm it works in `action` ctx (it should if it calls `getAuthUserId(ctx)`); if it needs a ctx it can't get in an action, have it throw a clear "Not signed in" error and resolve the user in the wrapper via `getAuthUserId`.

- [ ] **Step 2: Typecheck / codegen**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once`
Expected: compiles; `api.jobLeads.searchSenderForManualLead` + `api.jobLeads.addManualLeadFromMessage` exist.

- [ ] **Step 3: Commit**

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
git add convex/jobLeads.ts
git commit -m "feat(leads): session-authed public actions for manual lead-from-email"
```

---

### Task 6: UI panel in the Leads mode

**Files:**
- Modify: `jkChatWindow-LeadsMode.tsx` (locate via `find . -name "jkChatWindow-LeadsMode.tsx"`)

**Interfaces:**
- Consumes: `api.jobLeads.searchSenderForManualLead`, `api.jobLeads.addManualLeadFromMessage` (both `action`s → call via `useAction`).

- [ ] **Step 1: Add the panel** to the "All Leads" header area. Behavior:
  - Text input (placeholder "Sender's email address") + "Find emails" button. Basic email-shape validation before calling.
  - On submit: `const hits = await searchSender({ senderEmail })`. Loading spinner while pending. If `hits.length === 0`, show "No emails found from that address in your connected inboxes."
  - Render each hit as a card: `subject`, formatted `receivedAt` date, `snippet` (truncated), and a small `accountEmail` label. Card has a "Use this one" button.
  - On "Use this one": `const res = await addManual({ accountId: hit.accountId, messageId: hit.messageId })`. If `res.duplicate`, toast "Already added as a lead." Else toast "Lead added — drafting now." Clear the panel; the lead shows in the pending-approval list (existing reactive query refetches).

```tsx
// sketch — adapt imports/toast to the file's existing conventions
const searchSender = useAction(api.jobLeads.searchSenderForManualLead);
const addManual = useAction(api.jobLeads.addManualLeadFromMessage);
const [sender, setSender] = useState("");
const [hits, setHits] = useState<any[] | null>(null);
const [busy, setBusy] = useState(false);

async function onFind() {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sender)) return; // basic validation
  setBusy(true);
  try { setHits(await searchSender({ senderEmail: sender.trim() })); }
  finally { setBusy(false); }
}
async function onUse(hit: any) {
  setBusy(true);
  try {
    const res = await addManual({ accountId: hit.accountId, messageId: hit.messageId });
    // toast per res.duplicate
    setHits(null); setSender("");
  } finally { setBusy(false); }
}
```

- [ ] **Step 2: Deploy web**

Run: `cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3 && npx vercel --prod`
Expected: READY deployment.

- [ ] **Step 3: Manual end-to-end verify** on www.myjobkompass.com:
  - Open Job Leads → enter a real sender → see up to 3 cards → click one → lead appears in the approval queue with a draft + tailored resume → Approve & Send works. Re-adding the same one shows "already added."

- [ ] **Step 4: Commit**

```bash
cd /Users/itwelaibomu/Desktop/Code/jobkompass-v3
git add -A
git commit -m "feat(leads): 'Add lead from email' UI panel (sender search, pick-from-3)"
```

---

## Self-Review notes

- **Spec coverage:** sender search across both inboxes (Tasks 2–3, 6), pick-from-3 (Tasks 1 `mergeTopMessages`, 6), classifier-for-extraction-only force-to-lead (Task 1 `resolveLeadFields`, Task 4), reuse insertLead/draftForLead (Task 4), dedupe (Task 4), session-auth no-userId-arg (Task 5), error/empty/revoked handling (Tasks 3, 4, 6), UI in mode component (Task 6). All covered.
- **Verification honesty:** Pure logic (Tasks 1–2) is strict TDD under vitest. Convex actions and UI (Tasks 3–6) are verified via `npx convex run` against the live dev deployment and a real browser session, because Convex `ctx`-bound actions and React UI aren't meaningfully unit-testable in this repo's setup.
- **Deferred fallback:** the paste-text escape hatch is out of scope per spec; if Task 2/3 hit an unforeseen Gmail wall on the day, ship a minimal "paste the email text" box calling a trimmed `ingest` that skips `getMessage`.
