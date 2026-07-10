# Job Lead Email Agent — Manual Setup & Verification Checklist

All 13 code tasks from the implementation plan are built, reviewed, and committed on branch `worktree-job-lead-email-agent` in both repos:
- jobkompass-v3: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3/.worktrees/job-lead-email-agent`
- life-dashboard: `/Users/itwelaibomu/Desktop/Code/life-dashboard/.worktrees/job-lead-email-agent`

No live secrets exist in this environment, so every task's live-infrastructure verification step was skipped during implementation and collected here instead. Nothing below requires further code changes — it's configuration and manual testing only. Do these roughly in order; later steps depend on earlier ones.

## 0. Prerequisite: fix the life-dashboard schema conflict

Your life-dashboard **main** checkout (not this worktree) has uncommitted local changes to `convex/schema.ts` and `convex/dashboard.ts` (a `checkIns.dayTypes` field) that were deployed live to `dev:shiny-sheep-575` but never committed. **Any** `npx convex dev` from either checkout currently fails schema validation until this is reconciled:

```
Schema validation failed.
Document with ID "..." in table "checkIns" does not match the schema: Object contains extra field `dayTypes` that is not in the validator.
```

Fix: commit (or otherwise reconcile) the `dayTypes` field in your main life-dashboard checkout before attempting to deploy this feature's worktree branch there. This is unrelated to the job-lead-email-agent work but blocks Tasks 11 and 13's live verification below.

## 1. Google OAuth credentials (jobkompass-v3)

Create an OAuth 2.0 Client in Google Cloud Console with scopes `gmail.readonly`, `gmail.send`, `userinfo.email`, and redirect URI `http://localhost:3000/api/gmail/oauth/callback` (or your prod URL).

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
npx convex env set GOOGLE_CLIENT_ID "<from Google Cloud Console>"
npx convex env set GOOGLE_CLIENT_SECRET "<from Google Cloud Console>"
```

Add to `.env.local`:
```
GOOGLE_CLIENT_ID=<same value>
GOOGLE_CLIENT_SECRET=<same value>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/oauth/callback
```

## 2. OpenRouter key (jobkompass-v3)

Confirm `OPENROUTER_API_KEY` is set (used by classification, drafting, and resume tailoring):
```bash
npx convex env list | grep OPENROUTER_API_KEY
```

## 3. LaTeX resume service (jobkompass-v3)

Confirm `LATEX_SERVICE_URL` is set for prod, or that the dev fallback (`http://127.0.0.1:8080`) is running locally, if you want tailored-resume PDFs attached to drafts.

## 4. Connect Gmail accounts (jobkompass-v3)

Run `npm run dev`, sign in, visit `http://localhost:3000/api/gmail/oauth/start`, complete Google's consent screen. Confirm redirect lands on `/profile?gmail_connected=1` and a new `emailAccounts` row appears with `status: "active"`. **Repeat for a second Gmail account** — multi-account support is a core requirement.

## 5. Life Dashboard sync key (life-dashboard)

```bash
cd "/Users/itwelaibomu/Desktop/Code/life-dashboard"
openssl rand -hex 32
npx convex env set JOB_LEADS_SYNC_KEY "<the generated value>"
```
Record this value — Step 6 needs the identical key.

## 6. JobKompass → Life Dashboard sync config (jobkompass-v3)

```bash
cd "/Users/itwelaibomu/Desktop/Code/jobkompass-v3"
npx convex env set LIFE_DASHBOARD_SYNC_URL "https://<life-dashboard-deployment>.convex.site/jobLeads/sync"
npx convex env set LIFE_DASHBOARD_SYNC_KEY "<same key set in Step 5>"
```

## 7. Verify the sync endpoint directly (life-dashboard)

Once Step 0's schema conflict is resolved and a real `npx convex dev --once` succeeds:
```bash
curl -X POST "https://<life-dashboard-deployment>.convex.site/jobLeads/sync" \
  -H "Content-Type: application/json" \
  -H "X-Sync-Key: <the key from Step 5>" \
  -d '{"sourceLeadId":"test123","company":"Acme","role":"Engineer","sourceType":"personal_outreach","status":"sent"}'
```
Expected: `{"success":true}` and a new row in Life Dashboard's `jobLeads` table.

## 8. End-to-end verification (Task 14 from the original plan)

1. **Two connected accounts** — confirm from Step 4.
2. **Send two test emails** from an external account to one of the connected Gmail accounts: one that reads like direct recruiter outreach (specific company/role, personal tone), one that reads like a multi-listing job digest.
3. **Wait for the next poll cycle** (up to 5 minutes) and verify:
   - The outreach email produces a `jobLeads` row (`sourceType: "personal_outreach"`), eventually `status: "pending_approval"` with a `draftMessage` and (if a resume exists) a `draftResumeId`.
   - The digest email produces one row per listing (`sourceType: "digest_listing"`, `status: "extracted"`).
   - Both rows are visible on `/leads` in JobKompass and (once Step 0-7 above are done) mirrored into the Life Dashboard "Job Leads" tile.
4. **Approve the outreach lead** on `/leads`. Confirm the original Gmail thread shows a reply with the resume attached, and status becomes `"sent"` in both JobKompass and the Life Dashboard mirror.
5. **Promote the digest lead** via "Promote to Jobs". Confirm a new row appears in JobKompass's `/jobs` with status `"Interested"`, and the lead itself shows `status: "promoted"`.
6. **Follow-up cron (optional, takes ~6 days naturally)** — or force it: in the Convex dashboard, manually set a `sent` lead's `sentAt` to `Date.now() - 7 days`, invoke `emailAgent/followUp:checkFollowUps` from the function runner, confirm it moves to `pending_approval` with `isFollowUp: true`.
7. **Reply-detection (important negative test)** — from the external test account, reply to the thread where you approved a lead in Step 4, *before* 6 days pass. Confirm the lead's status moves to `"replied"` (not left as `"sent"`) on the next poll, and that it never appears as a follow-up candidate.

## 9. Design pass on the Life Dashboard tile (optional)

Task 13's reviewer noted the new "Job Leads" bento tile was fit into the existing fixed 6-cell grid by widening it to 4 columns (8 cells, one empty). This is functionally correct and read-only, but narrows the 6 existing tiles' proportions slightly — worth a quick visual look (`app/dashboard/page.tsx` / `app/dashboard/components/BentoCard.tsx` in the life-dashboard worktree) to confirm you're happy with the layout, or to pick a different placement.
