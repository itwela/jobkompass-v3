# Manual "Add lead from email" (sender-based, pick-from-3)

**Date:** 2026-07-23
**Status:** Approved design, pre-implementation

## Problem

The email agent finds job leads on its own: a cron polls the connected Gmail
accounts every 5 minutes, classifies each new message, and for recruiter
outreach drafts a reply plus a tailored resume that lands in the approval
queue as `pending_approval`.

Itwela sometimes wants to act on **one specific email right now** without
waiting for the poll and without depending on auto-detection catching it. He
wants to point JobKompass at a single email and have it run the exact same
draft → tailor-resume → approve/send pipeline, just for that one.

### Rejected input method: pasting the Gmail web link

The original idea was to paste the Gmail URL of the open email. This is not
buildable. The ID in a Gmail web URL (`#inbox/FMfcgz...`) is a private,
per-account web ID that Google wraps with a server key; the Gmail API never
returns it and there is no supported way to convert it to the API message ID
needed to fetch the message. Confirmed against Google's docs and the Google
Workspace CLI issue tracker (#858). So the entry point uses the sender's
address instead — something the connected Gmail API *can* resolve.

## Solution

A manual entry point in the Job Leads section: type a **sender's email
address**, JobKompass searches the connected inbox(es) for the most recent
**3** messages from that address, shows them as pick cards, and the one the
user clicks is ingested into the normal lead pipeline.

### User flow

1. In Job Leads, an "Add lead from email" box with a single text input
   (sender email) and a search button.
2. On search, JobKompass queries every connected `emailAccounts` row for the
   signed-in user with `from:<address>` and returns up to 3 most recent
   messages (merged across accounts, newest first).
3. Results render as cards: received date, subject, a one-line snippet, and a
   label for which connected account it came from.
4. The user clicks one card.
5. That message is turned into a `personal_outreach` lead (`status: "new"`)
   and `draftForLead` is scheduled — same as the auto path — so it appears in
   the approval queue with an AI draft and a tailored resume, ready for
   Approve & Send.

### Design decisions

- **Both inboxes, labeled.** Search all of the user's connected
  `emailAccounts` (currently deanandnostrand@gmail + iibomu@wgu.edu). Each
  result card shows its source account so there's no ambiguity.
- **Classifier runs for extraction only, never to reject.** The auto path uses
  `classifyEmail` both to decide "is this a lead" and to extract company/role.
  For a manual add the user has already decided it's a lead. So we still call
  `classifyEmail` to get company/role (the resume tailoring needs them), but we
  **force the lead to be created regardless** of the classifier's type verdict.
  If extraction fails or returns "neither", fall back to company =
  sender's domain (e.g. `company.com` → "Company") and role = "Unknown role",
  and still create the lead and draft. A manual add is never silently dropped.
- **Reuse the whole downstream.** Ingest calls the existing
  `jobLeads.insertLead` + schedules the existing
  `emailAgent.draft.draftForLead`. Draft, resume tailoring, approve, and send
  are untouched. The only new code is (a) a Gmail "search by sender, top 3"
  helper and (b) an "ingest the selected message" action.
- **Dedupe.** Before inserting, check `jobLeads.findByOriginalMessageId`. If
  that message is already a lead, don't create a duplicate — surface "already
  added" and (optionally) jump to the existing lead.
- **Auth: resolve the user from the session, never trust a userId arg.** The
  two new public functions resolve the Convex user via `resolveConvexUserId`
  (the pattern `jobLeads.list` / `markSeen` already use). This avoids repeating
  the existing security gap where some agent mutations accept an arbitrary
  userId.

## Components

### New

1. **`convex/emailAgent/gmailClient.ts` → `searchMessagesFromSender(gmail, senderEmail, max = 3)`**
   Uses `users.messages.list` with `q: "from:<senderEmail>"`, `maxResults: max`,
   then `getMessage` for each hit to pull subject / snippet / internalDate /
   RFC `Message-ID` / threadId. Returns lightweight metadata objects. Pure
   Gmail I/O; no Convex writes. Independently testable with a mocked
   `gmail_v1.Gmail`.

2. **`convex/emailAgent/manualLead.ts`** (new file)
   - `searchSenderMessagesInternal` (internalAction): args `{ userId, senderEmail }`.
     Loads the user's `emailAccounts`, calls `searchMessagesFromSender` per
     account, tags each result with `{ accountId, accountEmail }`, merges,
     sorts newest-first, returns up to 3. Handles a revoked token per account
     by marking it revoked (reuse `emailAccounts.markRevoked`) and skipping,
     so one dead account doesn't fail the whole search.
   - `ingestSelectedMessageInternal` (internalAction): args
     `{ userId, accountId, messageId }`. Fetches the full message, runs
     `classifyEmail` for company/role extraction with the force-to-lead
     fallback above, dedupes via `findByOriginalMessageId`, calls
     `insertLead` (`sourceType: "personal_outreach"`, `status: "new"`), and
     schedules `draftForLead`. Returns `{ leadId, duplicate: boolean }`.

3. **Public wrappers in `convex/jobLeads.ts`** (session-authed, no userId arg):
   - `searchSenderForManualLead` (action): args `{ senderEmail }` →
     `resolveConvexUserId` → `searchSenderMessagesInternal`.
   - `addManualLeadFromMessage` (action): args `{ accountId, messageId }` →
     `resolveConvexUserId` → `ingestSelectedMessageInternal`.

4. **UI in `jkChatWindow-LeadsMode.tsx`** (leads render as a chat-window mode,
   not the `app/leads` route). An "Add lead from email" panel in the All Leads
   header: input + search button → renders up to 3 result cards → click a card
   → calls `addManualLeadFromMessage` → toast + the new lead shows in the
   pending-approval list. Loading and empty states included.

### Reused (unchanged)

- `gmailClient.getGmailClient`, `getMessage`
- `emailAgent/classify` (`classifyEmail`)
- `jobLeads.insertLead`, `findByOriginalMessageId`
- `emailAgent/draft.draftForLead`, `tailorResumeOnly`
- `emailAccounts.markRevoked`
- Approval queue UI (`ApprovalQueue.tsx`), send path (`emailAgent/send.ts`)

## Data flow

```
UI (sender email) → searchSenderForManualLead (resolveConvexUserId)
  → searchSenderMessagesInternal → [per emailAccount] searchMessagesFromSender
  → up to 3 cards back to UI
UI (click a card) → addManualLeadFromMessage (resolveConvexUserId)
  → ingestSelectedMessageInternal
      → getMessage (full)
      → classifyEmail (extraction only; force-to-lead fallback)
      → findByOriginalMessageId (dedupe)
      → insertLead (personal_outreach, "new")
      → schedule draftForLead
  → lead appears in approval queue → existing Approve & Send
```

## Error handling

- **No results:** "No emails found from that address in your connected inboxes."
- **Revoked Gmail token:** mark the account revoked, skip it in the search,
  and if *all* accounts are revoked surface the existing reconnect prompt
  (Settings → Gmail accounts).
- **Duplicate message:** don't insert twice; tell the user it's already a lead.
- **Classifier failure:** do NOT drop — fall back to domain-derived company and
  "Unknown role", still draft (differs from the auto path, which skips on
  classifier failure).
- **Empty / malformed sender input:** validate it looks like an email before
  searching.

## Testing

- Unit: `searchMessagesFromSender` against a mocked Gmail client (query shape,
  max=3, field extraction).
- Unit: the merge/sort/top-3 logic in `searchSenderMessagesInternal` across
  multiple accounts.
- Unit: the ingest force-to-lead fallback (classifier returns "neither" →
  still creates a `personal_outreach` lead with domain-derived company).
- Unit: dedupe path (existing `originalMessageId` → no second insert).
- Integration: real sender address in a connected inbox → lead lands in the
  approval queue with a draft.

## Out of scope

- Paste-text fallback (viable escape hatch if needed, but not built here).
- `jk` CLI command for manual add (UI-first; a CLI wrapper can follow later).
- Any change to the auto-poll classifier behavior.
