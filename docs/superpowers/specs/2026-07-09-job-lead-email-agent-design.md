# Job Lead Email Agent — Design

## Problem

Itwela gets job-opportunity emails (recruiter/founder outreach, and job-board
digests) into his personal Gmail accounts and doesn't reliably know which are
worth pursuing. He wants an always-on agent that watches multiple Gmail
accounts, identifies job-opportunity emails from the last 14 days, drafts a
tailored resume + reply for direct outreach (sent only after his approval),
follows up once if there's no response, and surfaces everything — emails,
drafts, sends, replies — in a dashboard. Job-board digest emails (which have
no one to reply to) get split into individual leads instead of replied to.

## Scope

- Lives entirely inside JobKompass (Next.js + Convex + existing agent infra),
  reusing its resume tailoring, `resumes`/`resumeIRs` tables, and job-tracking
  patterns. Life Dashboard gets a read-only mirror, not its own copy of the
  logic.
- Must support 2+ of Itwela's own Gmail accounts from day one.
- Must run deployed/always-on — not dependent on any local machine being on.
- LLM calls (classification, extraction, drafting) go through OpenRouter, not
  the Claude API directly.
- Out of scope for this version: auto-sending without approval, auto-applying
  to digest listings, a second follow-up after the first, dashboard-side
  approve/reject actions (Life Dashboard is read-only for now).

## Architecture

```
Convex cron (every ~5 min)
  → poll each connected Gmail account (Gmail API, OAuth token from emailAccounts)
  → fetch messages newer than the account's stored historyId checkpoint
  → OpenRouter call: classify (personal_outreach / digest / neither) + extract fields
  → personal_outreach:
      → OpenRouter call: tailor a resume (reuses JobKompass's existing resume
        generation) + draft a reply message
      → store as a jobLead, status = "pending_approval"
      → appears in JobKompass's approval queue + mirrored to Life Dashboard
      → on approval → send via Gmail API as a reply in the original thread
      → no reply after ~6 days → generate one follow-up draft (approval-first,
        not auto-sent) → status "followed_up" after that, no further action
  → digest:
      → OpenRouter call: split into individual listings
      → each listing stored as its own jobLead, status = "extracted"
        (no draft, no approval — just visible in the dashboard)
  → neither: discarded, never stored
```

**Gmail access**: Gmail API with OAuth per account (not IMAP, not a forwarding
alias). Official, supported path; scopes are `gmail.readonly` + `gmail.send`;
since these are Itwela's own accounts, Google's unverified-app consent
click-through is sufficient — no app review needed. Preserves real thread
IDs, so replies and follow-ups land as genuine replies in the original
thread rather than disconnected new emails.

**Polling over push**: a 5-minute Convex cron is simpler to build than Gmail
push notifications (which need a Cloud Pub/Sub topic + domain verification)
and is fast enough to satisfy "as soon as I get them" in practice. Revisit
push notifications later only if 5 minutes ever feels too slow.

## Data model (new Convex tables, in JobKompass)

### `emailAccounts`
One row per connected Gmail account.

| field | type | notes |
|---|---|---|
| `userId` | string | owner |
| `email` | string | the Gmail address |
| `accessToken` / `refreshToken` | string (encrypted) | Gmail OAuth tokens |
| `historyId` | string | Gmail's checkpoint cursor; polling only fetches messages newer than this |
| `connectedAt` | number | |
| `status` | `"active"` \| `"revoked"` | surfaced in the dashboard when a token dies so a stalled account isn't silently ignored |

Index: `by_user`.

### `jobLeads`
Every lead sourced from email — both direct outreach and individual digest
listings. Deliberately separate from the existing `jobs` table: `jobs` stays
the manually-curated tracker for applications Itwela is actually pursuing;
`jobLeads` is the raw, unfiltered pile pulled from inboxes (including
possible scams and low-quality digest listings).

| field | type | notes |
|---|---|---|
| `userId` | string | owner |
| `sourceAccountId` | id → `emailAccounts` | which inbox this came from |
| `sourceType` | `"personal_outreach"` \| `"digest_listing"` | |
| `company`, `role` | string | extracted by the classifier |
| `senderEmail` | string | |
| `rawSnippet` | string | short excerpt of the original email for display |
| `originalMessageId`, `threadId` | string | Gmail IDs; required to reply in-thread |
| `status` | see below | |
| `draftResumeId` | optional id → `resumes`/`resumeIRs` | tailored resume, outreach path only |
| `draftMessage` | optional string | drafted reply text, outreach path only |
| `approvedAt`, `sentAt`, `followUpScheduledAt`, `followUpSentAt` | optional number | |
| `promotedAt` | optional number | set when copied into `jobs` |
| `classificationError` | optional bool | set when an OpenRouter call fails/returns malformed JSON, so it gets retried instead of silently dropped |
| `createdAt`, `updatedAt` | number | |

Status values, outreach path: `new` → `pending_approval` → `sent` →
(optionally) `followed_up` — plus `replied` when the sender responds, and
`closed` for anything manually dismissed. Digest path: just `extracted`,
with an optional `promoted` once turned into a real `jobs` row.

Indexes: `by_user`, `by_status`, `by_user_and_status`.

### Promote-to-`jobs` action
A mutation that copies a `jobLead`'s company/role/link/resume-used into a
new `jobs` row with status `"Interested"`, then sets `promotedAt` on the
lead so it stops showing as a dangling lead. Manual action, triggered from
the dashboard — never automatic.

## Flow details

**Classification** (OpenRouter call #1, per new email): given
subject/sender/body, returns structured JSON:
`{ type: "personal_outreach" | "digest" | "neither", company, role, senderName }`
for outreach, or `{ type: "digest", listings: [{company, role, link}, ...] }`
for digests. `"neither"` (newsletters, receipts, unrelated mail) is discarded
immediately and never stored.

**Drafting** (OpenRouter call #2, `personal_outreach` only): reuses
JobKompass's existing resume-tailoring flow to produce a tailored resume
from the role/company context, plus a short reply message. Both attach to
the `jobLead` (`draftResumeId`, `draftMessage`); status → `pending_approval`.

**Approval queue**: a view in JobKompass, mirrored to Life Dashboard, listing
all `pending_approval` leads with the draft message and resume preview.
Approve → send via Gmail API as a reply in the original thread
(`threadId`/`originalMessageId`); status → `sent`. Reject/edit is also
available, not just accept-as-is.

**Follow-up**: a daily cron checks `sent` leads older than ~6 days with no
reply visible in the Gmail thread, and generates one follow-up draft
(approval-first, same as the initial draft). After that draft is sent (or
skipped), status → `followed_up` — no second follow-up.

**Digest path**: no drafting, no approval. Listings land as `extracted`
leads, browsable and promotable from the dashboard.

## Life Dashboard mirror

A new `jobLeads` table in Life Dashboard's Convex, mirroring the same
fields, read-only. Kept in sync the same way the existing vault-todos sync
works: one-way push. Concretely, a Convex scheduled function in JobKompass
pushes the updated row to a Life Dashboard `httpAction` endpoint after any
`jobLeads` write, authenticated with an API key (same pattern as the
existing `agentApiKeys` table). Life Dashboard never writes back —
approvals, edits, and promotions all happen in JobKompass. Making the
dashboard itself actionable (approve/reject from Life Dashboard) is a
reasonable later follow-up, not part of this version.

## Error handling

- Gmail token expired/revoked → `emailAccounts.status = "revoked"`, shown as
  a visible warning in the dashboard rather than failing silently.
- OpenRouter call fails or returns malformed JSON → lead stored with
  `status: "new"` and `classificationError: true`, retried on the next poll
  cycle instead of being dropped.
- Duplicate Gmail delivery → dedupe on `originalMessageId` before creating a
  new lead.
- Send failure on approval → lead stays `pending_approval` with an error
  note; never silently marked `sent`.

## Testing

- Unit-test the classification/extraction prompt against a handful of saved
  real examples (a genuine recruiter email, a LinkedIn-style digest, a
  newsletter) to confirm the JSON contract holds.
- Connect one Gmail account first; verify a full poll → classify → draft →
  approve → send round-trip before adding a second account.
- Verify the promote-to-`jobs` mutation end-to-end.
- Verify the Life Dashboard mirror reflects a lead's status change after
  approval/send.
