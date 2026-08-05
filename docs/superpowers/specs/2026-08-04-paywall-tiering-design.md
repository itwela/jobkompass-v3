# Paywall Tiering, Template Gating, and Pricing Page Fixes

Date: 2026-08-04
Status: Approved for planning

## Problem

JobKompass was built before the CLI and Chrome extension existed. Its paywall
never caught up. Today:

- Every resume template is available to every user, including free users.
- The agent API (and therefore `jobkompass-cli`, public on npm since 0.1.5)
  authenticates any valid key regardless of plan.
- The Chrome extension endpoint `/extension/saveJob` authenticates any valid key
  regardless of plan.
- The pricing page advertises tiering that the code does not enforce.

Separately, two UI defects and one chat bug are folded in because they touch the
same surfaces.

## Plan model

### Tier ranks

| Rank | Tier | `planId` values |
|---|---|---|
| 0 | Free | `free`, absent subscription |
| 1 | Starter | `starter` |
| 2 | Plus | `plus`, `plus-annual` |
| 3 | Pro | `pro`, `pro-annual` |

### Active statuses

A subscription grants its tier when `status` is `active`, `trialing`, or
`past_due`. `past_due` is included deliberately: a failed card retry should not
kill someone's tooling for the days Stripe spends retrying.

Any other status resolves to rank 0.

### New module: `convex/plans.ts`

Single source of truth. Three exports:

- `planRank(subscription): 0 | 1 | 2 | 3` — the tier check above.
- `meetsTier(subscription, minRank): boolean` — the gate every caller uses.
- `hasProPlanEver(subscription): boolean` — the **existing** never-demote rule
  extracted verbatim from `convex/usage.ts:186`, where a `pro` plan grants
  unlimited jobs without consulting `status`.

`hasProPlanEver` exists so that job-limit behavior does not change. It is named
distinctly so the divergence from `planRank` is deliberate and legible rather
than something a future reader files as a bug.

**Job-limit behavior in `convex/usage.ts` is out of scope and must not change.**
Existing users keep exactly the access they have today.

## Template tiering

| Template | Min rank | Available to |
|---|---|---|
| Jake | 0 (Free) | everyone |
| Joseph | 1 (Starter) | Starter, Plus, Pro |
| Mar | 3 (Pro) | Pro only |

Mar is the premium hook and does not appear below Pro. Joseph is set to rank 1,
not 2, because the $2.99 Starter pass includes it.

### Prerequisite: collapse the duplicate validator

`isValidResumeTemplateId` is currently defined twice with different backing data:

- `lib/templates.ts:89` — checks `RESUME_TEMPLATES`
- `lib/resume/generators.ts:41` — checks `RESUME_TEMPLATE_IDS` after alias resolution

Different routes import different copies. Gating one while the other stays open
is precisely how this leaks. Collapse to one function before adding any gate.

`freeResumeEligible` on the `Template` interface stays untouched — it answers a
different question (eligibility in the logged-out lead-magnet generator) and is
unrelated to subscriber tiering. Add `minRank` alongside it.

### Enforcement points

All server-side. The picker UI is presentation, not a gate.

1. `app/api/resume/export/[templateId]/route.ts`
2. The AI chat tool, `app/ai/tools/file.ts`
3. The agent API resume add/update paths in `convex/agent/fns.ts`

The logged-out free generator (`app/api/free-resume/generate/route.ts`) is
already Jake-only via `freeResumeEligible` and needs no change.

### Behavior on violation, by surface

- **API and CLI** — hard reject, HTTP 402, `code: "tier_required"`, with the
  required tier and an upgrade URL in the hint. Machine callers need an
  unambiguous error. This code is distinct from the CLI's own
  `subscription_required` below: `tier_required` means "your plan cannot use
  this template," `subscription_required` means "your plan cannot use the CLI at
  all." A Plus user hitting the API sees the former; a free user sees the latter
  first and never reaches template validation.
- **AI chat** — fall back to Jake and return a flag so the assistant can say
  "Mar needs Pro, so I generated this in Jake." The user did not choose the
  template here, the model did; a hard refusal is a dead end.

## CLI gate (Pro only)

`convex/agent/auth.ts` exposes a single `authenticate()` that every agent route
funnels through (`convex/agent/dispatch.ts:89`). The gate goes there, directly
after the key lookup succeeds.

- Requires rank >= 3.
- Failure throws `AgentError(402, "subscription_required", ...)` with an upgrade
  URL in the hint.

### Exemptions

`/agent/ping` and `/agent/schema` accept any valid key regardless of plan.
`jk auth status` hits ping; without this exemption a lapsed user sees only
"invalid key" and cannot tell a billing problem from a broken credential.

### CLI-side rendering

`jobkompass-cli` must render a 402 as a plain sentence naming the plan and the
upgrade URL, not a stack trace or a bare JSON dump.

## Chrome extension gate (Plus and above)

`convex/http.ts:55` currently accepts any key that exists in `extensionApiKeys`.
Add a rank >= 2 check after `lookupByKey`, returning 402 in the same envelope
shape the route already uses.

Starter is deliberately excluded (rank 1 < 2).

This endpoint is already deployed and ungated, so this is a live hole, not
preparation for a future launch.

## Chat download fix

**Cause.** `app/jk-components/jk-chatwindow-components/jkChatWindow-ChatMode.tsx:739`
builds the download as `href={data:application/pdf;base64,...}`. Browsers
restrict the `download` attribute on `data:` URLs, Safari most aggressively.
Every other download path in the app was moved to a blob fetch in commit
`ed75c79`; chat was missed.

**Second problem, same root.** `app/ai/tools/file.ts:309` returns the full
`pdfBase64` as its tool result. Tool results re-enter the model's message
history, so every resume generation injects roughly 55,000 characters (~14k
tokens) of base64 into the thread and every subsequent turn pays for it. It is
also why the render code carries five nested fallback branches
(`jkChatWindow-ChatMode.tsx:648-693`) hunting for where the base64 landed.

**Fix.** The tool already auto-saves the PDF to Convex storage; it simply does
not return the id.

1. `app/ai/tools/file.ts` returns `{ storageId, resumeId, fileName }` and stops
   returning `pdfBase64`.
2. `jkChatWindow-ChatMode.tsx` calls `downloadFirstVersionResume` from
   `providers/jkDocumentsProvider.tsx` — the blob path already proven elsewhere.
3. Delete the five fallback branches.

This fixes the download and removes the context bloat in one change.

**Verification:** confirm the failure reproduces in a browser before the fix and
that the fixed path saves a file on both desktop and mobile Safari. The cause
above is read from source, not yet observed live.

## Template switch on the generated-resume card

A row beneath the card: "Want this in a different template?" showing all three
templates.

- **User whose rank meets the chosen template's `minRank`** — regenerates the
  PDF **in place** on the same resume record. Same id, same name, same content,
  PDF swapped. No new record, and no document-generation credit charged, because
  the content is unchanged. This reuses the path `jk resumes update --template`
  already implements (CLI 0.1.5).
- **User whose rank falls below it** — that template renders locked, and
  clicking opens the pricing modal.

Entitlement is evaluated per template, not per user: a Plus user sees Jake and
Joseph unlocked and Mar locked, in the same row.

Locked templates are shown, not hidden. A user who cannot see a feature cannot
be converted by it.

Routing this through the chat was considered and rejected: it would cost a model
turn, be nondeterministic, be slow, and burn a generation credit for what is a
deterministic re-render of saved content.

## Pricing page

### Mobile buttons look disabled

`app/jk-components/jkPricing.tsx:346` — the signed-out CTA carries `opacity-60`
and only recovers via `group-hover/card:opacity-100`. Touch devices have no
hover, so on mobile the button is permanently dimmed and reads as disabled.

Fix: render at full opacity by default. The logged-in button (line 366) already
does this and needs no change.

### Dark mode blue-on-black text

`app/globals.css:161` sets `--primary-foreground: #0b0c0f` in the dark theme
while `--primary` stays `#2196f3` in both themes. Every `bg-primary
text-primary-foreground` surface therefore renders near-black text on blue in
dark mode, including the Most Popular badge (`jkPricing.tsx:290`). Light mode
(line 107) is already `#ffffff`.

Fix: set the dark theme's `--primary-foreground` to `#ffffff`.

This is an app-wide token. The change intentionally corrects every blue surface
in dark mode, not only the pricing page. Since `--primary` is identical in both
themes, white is the correct pairing in both.

Note: white on `#2196f3` measures roughly 3:1 contrast, which satisfies WCAG AA
for large text and UI components but not for small body text. Accepted as a
deliberate visual decision. If it needs to clear 4.5:1 later, darken the dark
theme's `--primary` rather than reverting the foreground.

### Copy rewrite

Two claims become false with this release and must be corrected:

- **Starter** currently promises "Full access for 7 days" and "All premium
  templates." Neither is true: Starter gets Jake and Joseph, no Mar, no CLI, no
  extension.
- **Plus** currently promises "All premium templates." Plus does not include Mar.

Pro's feature list gains CLI access as its headline exclusive. Plus's list gains
Chrome extension access. Each tier's template entitlement is stated explicitly
rather than as "premium templates."

## Testing

- **Unit, `convex/plans.ts`** — the full plan × status matrix against expected
  rank, including `past_due` granting access and cancelled resolving to 0.
- **Unit, template gating** — each template against each rank, asserting Starter
  reaches Joseph and stops before Mar.
- **Unit, `hasProPlanEver`** — a cancelled `pro` subscription still returns true,
  proving job-limit behavior is preserved.
- **Regression** — `lib/resume/marLatex.test.ts` and
  `lib/resume/templatePreference.test.ts` stay green.
- **Manual** — chat download on desktop and mobile Safari; pricing page in dark
  mode and on a touch device.

Gate on `tsc --noEmit` and `vitest`. Repo lint is non-functional (`next lint`
was removed in Next 16 and the eslint config crashes); do not attempt to fix it
as part of this work.

## Out of scope

- Job-limit behavior in `convex/usage.ts`, including the never-demote rule.
- Building or shipping the Chrome extension client. This spec gates the endpoint
  that already exists.
- Stripe price or product changes. Tier prices and price IDs stay as they are.
- Repo lint.

## Deployment note

`generateMarLatex.ts` reads its `.tex` from disk at runtime via `process.cwd()`,
and `jk resumes add` reaches production through
`${APP_BASE_URL}/api/resume/export/<template>`. Server-side template gating
therefore has no effect on CLI callers until the Next.js app is deployed to
production, independently of the Convex push. Both deploys are required.
