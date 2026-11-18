# Architecture

How JobKompass is put together. This page describes the code as it is in the `redesign/v4` working tree, which is ahead of `main`. File paths are relative to the repo root.

## Overview

```
 Browser                    jk CLI / AI agent           Chrome extension
    |                              |                           |
    | pages, /api/* routes         | Bearer key                | key in JSON body
    v                              v                           v
+-------------------+      +-------------------------------------------+
| Next.js app       |      | Convex deployment                         |
| (Vercel)          |<---->|  queries, mutations, actions              |
|  app/             |      |  HTTP routes: /api/auth/*, /agent/*,      |
|  app/api/         |      |               /extension/saveJob          |
|  lib/             |      |  database, file storage, rate limiter     |
+-------------------+      +-------------------------------------------+
    |        |                             |
    |        +--> OpenRouter / OpenAI <----+
    |
    +--> LaTeX compile service (POST /compile)
    +--> Stripe (checkout, portal, webhook)
```

There are three ways in:

1. **The web app.** React pages talk to Convex directly for data and call Next.js API routes for anything that needs a model, Stripe, or the PDF service.
2. **The agent API.** Convex HTTP routes under `/agent/*`. The `jk` CLI is a thin client for them.
3. **The extension endpoint.** One Convex HTTP route, `/extension/saveJob`.

All three read and write the same Convex tables.

## Next.js app

### Pages

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/app` | The product. One page that switches between modes. |
| `/auth`, `/auth/reset` | Sign in, sign up, password reset |
| `/onboarding` | First-run flow: upload a resume, add a job, get a tailored resume |
| `/pricing`, `/stripe/success` | Plans and the post-checkout page |
| `/free-resume-generator` | Public resume formatter |
| `/r/[shareId]` | Public share link that streams a resume PDF |
| `/profile`, `/contact`, `/privacy`, `/terms`, `/waitlist` | Account and static pages |
| `/dev/kit` | Component kit used during the redesign |

`/app` does not use a route per screen. The current mode lives in `providers/jkChatWindowProvider.tsx`, and the navigation list is in `app/jk-components/jk-app/jkAppNav.ts`: My Jobs, My Documents, Interview Prep, Performance, Links & Resources, Chat, plus Help and Settings. Each mode is a component under `app/jk-components/jk-chatwindow-components/`.

### API routes

All under `app/api/`.

| Route | Purpose |
| --- | --- |
| `chat`, `chat/retitle` | The chat agent and thread titles |
| `resume/assist` | Rewrite help inside the resume editor |
| `resume/answers` | Save answers to bullet questions and rewrite the tailored resume |
| `resume/export/[templateId]` | Resume JSON to PDF. The single place template access is checked. |
| `resume/switch-template` | Re-render an existing resume in another template |
| `coverletter/export/jake` | Cover letter to PDF |
| `template/generate` | Generate a resume or cover letter from a job in My Jobs |
| `documents/generate-resume-pdf` | Extract resume content from an uploaded file |
| `jobs/add` | Add a job from pasted text or a link |
| `interview-prep/generate` | Build an interview prep deck |
| `performance/summary` | Written summary on the Performance screen (Pro) |
| `onboarding/resume`, `onboarding/job`, `onboarding/tailor` | The three onboarding steps |
| `free-resume/generate` | The free generator |
| `stripe/checkout`, `stripe/portal`, `stripe/webhook` | Billing |
| `introduction` | Static JSON |

Routes that call a model start with `enforceAiRateLimit` from `lib/rateLimit/guard.ts`. See [Rate limiting](#rate-limiting).

### Providers

`providers/` holds one React context per concern: Convex client, auth, subscription, jobs, documents, resumes, resources, chat window state, theme, toasts, help and analytics.

## Convex backend

### Tables

Defined in `convex/schema.ts`.

| Group | Tables |
| --- | --- |
| Users and auth | `users`, plus the tables Convex Auth adds (`authTables`) |
| Jobs | `jobs` |
| Documents | `resumes`, `resumeIRs`, `coverLetters`, `documentFolders`, `emailTemplates` |
| Chat | `threads`, `messages` |
| Interview prep | `interviewPreps` |
| Performance | `performanceInsights` |
| Resources | `resources` |
| Billing | `subscriptions`, `referrals` |
| API keys | `agentApiKeys` (CLI), `extensionApiKeys` (extension) |
| Public pages | `waitlist`, `emailList`, `contacts`, `freeResumeGenerations` |
| Retired email agent | `emailAccounts`, `jobLeads` |

The rate limiter is a Convex component (`convex/convex.config.ts`) and keeps its own tables.

Resume PDFs live in Convex file storage. The `resumes` row holds the file id and the structured content the PDF was rendered from, so a resume can be edited or re-rendered in another template without parsing the PDF again.

### Functions

One file per area in `convex/`:

| File | Area |
| --- | --- |
| `auth.ts`, `authLinking.ts`, `authPasswordReset.ts` | Sign-in, account linking, password reset |
| `jobs.ts`, `jobStatusHistory.ts` | Jobs and their status history |
| `documents.ts`, `documentFolders.ts`, `baseResume.ts`, `documentCount.ts`, `resumeShares.ts` | Resumes, cover letters, folders, the base resume, share links |
| `threads.ts` | Chat threads and messages |
| `interviewPreps.ts`, `performanceInsights.ts`, `resources.ts` | Their screens |
| `subscriptions.ts`, `plans.ts`, `usage.ts` | Billing state, plan ranks, limits |
| `rateLimit.ts`, `rateLimits.ts`, `rateLimitConfig.ts` | AI rate limits |
| `extensionApiKeys.ts`, `extensionSaveJob.ts` | The extension |
| `agent/` | The agent API |
| `http.ts` | HTTP router |
| `crons.ts` | Scheduled jobs. Currently empty. |

`convex/emailAccounts.ts`, `convex/jobLeads.ts` and `convex/emailAgent/` belong to an email job-leads feature that has been retired. Nothing schedules it and the UI for it has been removed.

## Auth

Convex Auth (`convex/auth.ts`) with two providers:

- **Password**, with reset codes sent by email through Resend (`convex/authPasswordReset.ts`).
- **Google** OAuth.

`convex/authLinking.ts` decides what happens when a sign-in arrives with an email that already belongs to an account: link, reuse or refuse.

OAuth may only redirect back to `SITE_URL` or `http://localhost:3000`.

On the Next.js side, `proxy.ts` runs the Convex Auth middleware. API routes read the caller's token with `convexAuthNextjsToken()` and pass it to Convex, so a route never trusts a user id from the request body.

## Plans and limits

`convex/plans.ts` is the one source of plan rules. A plan is a rank, and every paywall is a rank comparison.

| Rank | Plan ids |
| --- | --- |
| 0 Free | `free` |
| 1 Starter | `starter` |
| 2 Plus | `plus`, `plus-annual` |
| 3 Pro | `pro`, `pro-annual` |

A subscription counts while its status is `active`, `trialing` or `past_due`. `past_due` is kept so a failed card retry does not cut access while Stripe retries.

What each rank gates:

| Feature | Minimum plan | Where it is checked |
| --- | --- | --- |
| Jake resume template | Free | `lib/templates.ts`, enforced in `app/api/resume/export/[templateId]/route.ts` |
| Joseph resume template | Starter | same |
| Mar resume template | Pro | same |
| Premium resume writer model | Starter | `isPremiumRank` in `lib/resume/tailorServer.ts` |
| Chrome extension | Plus | `convex/http.ts` |
| Agent API and `jk` CLI | Pro | `convex/agent/dispatch.ts` |
| Performance summary | Pro | `app/api/performance/summary/route.ts` |

Monthly limits from `convex/usage.ts`:

| Plan | Generated documents per month | Saved jobs |
| --- | --- | --- |
| Free | 3 | 10 |
| Starter | 10 | 100 |
| Plus | 60 | 100 |
| Pro | 180 | Unlimited |

Two details worth knowing before changing this code:

- An unknown template id is treated as Pro, so a typo fails closed.
- Job limits never demote a Pro plan, even a lapsed one (`hasProPlanEver`). Paywalls do. The two functions disagree on purpose.

Stripe is the source of subscription state. `app/api/stripe/webhook/route.ts` receives Stripe events and writes the `subscriptions` table through `convex/subscriptions.ts`.

## Resume pipeline

```
base resume JSON + job posting + saved answers
        |
        v
tailorResume()            lib/resume/tailorResume.ts
  prompt                  lib/resume/writingStandard.ts
  model call              OpenRouter, models from lib/aiModels.ts
  structure check         sameStructure()            lib/resume/bulletQuestions.ts
  fact guard              scrubInventedExperience()  lib/resume/noInventedFacts.ts
  restore dropped bullets restoreDroppedBullets()
  questions               sanitizeQuestions()
        |
        v
tailorAndSaveWith()       lib/resume/tailorCore.ts
                          (app: tailorAndSave() in lib/resume/tailorServer.ts;
                           agent API: convex/agent/tailor.ts + tailorFlow.ts)
  must-haves              lib/chat/mustHaves.ts
  scorecard               lib/resume/scorecard.ts
  change list             lib/onboarding/resumeChanges.ts
  LaTeX + PDF             lib/resume/generators.ts -> LaTeX service
  save                    convex/documents.ts
```

### Writing

`tailorResume` sends the resume JSON, the posting and the candidate's saved answers to the writer model. The plan's writer is tried first, then the standard writer. Each model gets two attempts.

An attempt is rejected when:

- the response is not usable JSON, or
- the model added, removed, renamed or reordered a job or a project.

### The fact guard

The rule: the resume is the only source of facts about the candidate. The posting says what the employer wants. It is never evidence of what the candidate has done.

`scrubInventedExperience` compares the model's output with the source resume plus the candidate's answers. A rewritten bullet that states something the source does not is replaced with the source bullet, so a real job is never left empty. The definition of a violation lives in `tests/no-invented-experience/checker.ts`, and the suite in that folder is the regression test for the rule.

The same guard is applied to chat replies, cover letters and extraction paths. See `guardChatTurn`, `claimFreeLetter` and `fallbackResumeFromText` in `lib/resume/noInventedFacts.ts`.

### Questions and answers

The writer may return up to five questions (`MAX_QUESTIONS`), each tied to one bullet in one experience or project entry. A question is only kept when the bullet has no number yet and has not been answered before.

Answers are saved on the base resume as `bulletAnswers`. They have the same standing as the resume itself: the next tailoring run passes them to the writer and to the fact guard as source material. The writer must use the candidate's numbers exactly as given.

Surfaces:

- **Chat.** Questions appear as cards (`app/jk-components/jk-resume-questions/`). Answering posts to `app/api/resume/answers`, which saves the answers and rewrites the tailored resume in place.
- **CLI.** `convex/agent/resumeQuestions.ts` builds questions without a model by default. `convex/agent/tailor.ts` holds the model-backed paths.

### Scorecard

`lib/resume/scorecard.ts` counts how many bullets state a number and how many still read like a duty. It is a pure function with no model call.

### Templates and PDF export

Three templates are selectable: `jake`, `joseph`, `mar`. Each has a generator in `lib/resume/` (`generateJakeLatex.ts`, `generateJosephLatex.ts`, `generateMarLatex.ts`), and `lib/resume/generators.ts` picks one by id.

PDF export does not run LaTeX inside the app. The export route builds a LaTeX string and posts it to a separate service:

```
POST {LATEX_SERVICE_URL}/compile
{ "latex": "...", "filename": "resume-<id>" }

200 { "pdfBase64": "..." }
```

`app/api/resume/export/[templateId]/route.ts` is the gate for this. A caller is either a signed-in user, whose plan is checked against the template, or trusted server code that sends the shared `RESUME_EXPORT_SECRET` in a header. Convex actions use the second path, which is why that secret must match on Vercel and on the Convex deployment.

In development the app falls back to `http://127.0.0.1:8080` when `LATEX_SERVICE_URL` is not set. The service itself is not in this repository. [guides/latex-service-setup.md](guides/latex-service-setup.md) describes it.

## Agent API and the CLI

The agent API is a set of Convex HTTP routes registered by `convex/agent/dispatch.ts`.

- **Route table.** `convex/agent/routes.ts` declares every route with its method, path, parameters and the function it calls. `GET /agent/schema` returns that table as JSON, which is how an agent learns the API without documentation.
- **Auth.** `convex/agent/auth.ts` reads `Authorization: Bearer <key>`, hashes the key with SHA-256 and looks up the hash in `agentApiKeys`. Only the hash is stored. The plaintext key is shown once when it is created. A revoked key stops working immediately.
- **Plan.** Every route except `/agent/ping` and `/agent/schema` requires the Pro plan. A lower plan gets a 402 with a hint.
- **Ownership.** Functions in `convex/agent/fns.ts` take the user id that auth resolved, never one from the request, and check that each row belongs to that user.
- **Errors.** `AgentError` carries a status, a code, a message and a hint for the caller.

Resources: jobs, resumes, cover letters, email templates, resources, interview preps, and read access to chat threads.

The CLI in `cli/` maps commands to these routes. It prints JSON when stdout is piped, never prompts, and requires `--yes` for destructive commands. Its default base URL is the live Convex site URL. `JK_BASE_URL` overrides it.

## Extension endpoint

`POST /extension/saveJob` in `convex/http.ts`. The body carries an extension API key, the page text, the URL and the title.

1. Look up the key in `extensionApiKeys`.
2. Check the plan: Plus or higher, otherwise 402.
3. Spend one request from the `extension` rate-limit bucket, otherwise 429 with `Retry-After`.
4. `convex/extensionSaveJob.ts` parses the page text with a model and inserts a job. A "Job limit" error from that step is returned as 429.

The route allows any origin because it is called from extension content on arbitrary sites. Access is controlled by the key.

Extension keys are separate from CLI keys and are stored differently: the `extensionApiKeys` table holds the key string itself.

## Rate limiting

AI calls are limited with the `@convex-dev/rate-limiter` component. The numbers are in `convex/rateLimitConfig.ts`:

| Bucket | Keyed by | Limit |
| --- | --- | --- |
| `ai` | Signed-in user id | 30 per hour, burst of 8 |
| `anonymousAi` | Hashed IP | 8 per hour, burst of 3 |
| `freeResume` | Hashed IP | 5 per hour, fixed window |
| `extension` | Extension user id | 15 per hour, burst of 3 |
| `emailAgent` | Retired email agent | 40 per hour, burst of 8 |

One HTTP request counts once, however many model calls it makes. Over the limit, a route returns 429 with a `Retry-After` header.

If the limiter cannot be reached, the check fails open: the request goes through and the server logs a warning.

Full detail, including which routes are covered and how keys are built, is in [rate-limiting.md](rate-limiting.md).

## Models

Model ids are in `lib/aiModels.ts`.

| Use | Default |
| --- | --- |
| Resume writer, standard | `RESUME_WRITER_MODEL_ID` |
| Resume writer, paid plans | `RESUME_WRITER_PREMIUM_MODEL_ID`, with the standard writer as fallback |
| Resume extraction | `DEFAULT_RESUME_EXTRACTION_MODEL_IDS`, primary then fallback |
| Chat | `CHAT_MODEL_ID` |
| Document generation from My Jobs | `TEMPLATE_GENERATION_MODEL_ID` |

Writer and extraction models can be overridden with environment variables. The names are in the root [README](../README.md#environment-variables).

## Analytics

PostHog, through `lib/analytics/`. Nothing is sent when `NEXT_PUBLIC_POSTHOG_KEY` is empty. `instrumentation.ts` reports server errors. See [analytics.md](analytics.md).

## Deployment

- **Frontend:** Vercel builds the Next.js app.
- **Backend:** `npm run deploy:backend` pushes `convex/` to the deployment the live site, the CLI and the extension all use. Never `npx convex deploy`.
- **PDF service:** deployed separately.

A Vercel build does not push Convex functions. The reasons behind the backend rule are in the root [README](../README.md#deploying).
