# AI rate limiting

AI calls are limited with the Convex component `@convex-dev/rate-limiter` (0.4.x). There is no Redis, Upstash, or other new vendor. The numbers live in one file: `convex/rateLimitConfig.ts`.

Limits do nothing until that component is deployed. Until then every check fails open: the AI feature still runs, and the server logs a short warning. See [Deploy](#deploy) before changing production.

## Limits

| Bucket | Who | Kind | Limit |
| --- | --- | --- | --- |
| `ai` | Signed-in user id from the Convex auth token | Token bucket | 30 requests per hour, burst of 8 |
| `anonymousAi` | Logged-out caller, hashed IP | Token bucket | 8 requests per hour, burst of 3 |
| `freeResume` | Free resume generator, hashed IP, even if signed in | Fixed window | 5 requests per hour |
| `extension` | Chrome extension user id | Token bucket | 15 requests per hour, burst of 3 |
| `emailAgent` | Inbox classify, tailor, and draft | Token bucket | 40 requests per hour, burst of 8 |

One HTTP request counts as one, even when chat or template tools call a model more than once inside that request. One email-agent action counts as one, even when a draft both tailors a resume and writes a reply.

The free generator does not share a bucket with chat. The email agent does not share a bucket with chat, so a busy inbox cannot lock the product UI.

`rate` is how many requests refill over `period`. `capacity` is how many can fire in a burst. A fixed window allows `rate` requests and then waits until the window ends.

## Keys

Signed-in product routes use the Convex auth user id. They do not trust a user id sent in the JSON body.

Logged-out routes and the free generator use `ip:` plus the first 32 hex characters of a SHA-256 of the client address. The address is taken from the first `x-forwarded-for` hop, or `x-real-ip`. The raw address is not stored and not written to logs. If those headers are missing, every such caller shares `ip:unknown`.

The public `rateLimits.consume` mutation checks the key shape. A raw IP, an email, or any other string is treated as `ip:unknown`. Direct calls to that mutation do not call a model. They can still spend the `ip:unknown` bucket after the function is deployed.

## What users see

Next routes return HTTP 429 with a `Retry-After` header in seconds and `Cache-Control: no-store`. The JSON body is `{ "error": "Too many requests. Please try again later." }`. The UI shows a sentence that includes the wait when `Retry-After` is present. A 429 on template generation does not open the plan upgrade modal. Plan document limits stay on 403.

The extension `/extension/saveJob` endpoint returns the same 429. That is separate from the Plus plan check and from the "Job limit" plan error.

When inbox classification is over the limit, that poll stops and does not advance the Gmail history cursor, so the mail is tried again later. It is not labeled "neither". A manual "add lead from email" shows "Too many AI requests. Try again in a few minutes." Tailor-resume records that same sentence on the lead. A reply draft skips the model, keeps the lead reviewable with the existing generic fallback sentence, and records the same error on the resume.

## Deploy

This repo does not deploy Convex by itself.

- `package.json` `build` is `next build`.
- There is no `vercel.json`.
- GitHub Actions runs install, lint, typecheck, and vitest. It does not run `convex deploy` or `convex dev`.

A merge to `main` updates the Next.js app. It does not install the rate-limiter component. Vercel may build the Next app. That build does not push Convex functions.

The live site reads the Convex **dev** slot `dev:proficient-mammoth-632`. Pushing this component means running Convex against that slot, for example:

```bash
CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex dev --once
```

Do not run that, or `npx convex deploy`, or any Convex dashboard push, without the owner's approval. `npx convex dev` writes to the deployment the live site uses. There is no separate staging slot.

What that push changes:

- It creates the rate-limiter component's own tables.
- It pushes the new `rateLimits.consume` function and the checks inside the email agent and extension HTTP action.
- It does not change existing app tables.

Until that push happens, the new Next code calls a function that is not on the deployment yet. The call throws, the route logs a warning, and the AI request is allowed. The same fail-open applies if the function is deployed and the component tables are not.

A Convex dashboard "deploy on git push" setting is not in this repo, so this document cannot confirm it is off. Do not approve a Convex push from the dashboard either.

Installing `@convex-dev/rate-limiter@0.4.0` also moved the `convex` npm package to 1.46.x (the component requires `convex` ^1.43). That is the client library in this repo. It is not a Convex deployment.

## How to tune

Edit `convex/rateLimitConfig.ts` only. Then the new numbers apply on the next approved push to `dev:proficient-mammoth-632`. Changing the file in git does not change production limits by itself.

## How to test

Unit tests mock the limiter and do not call Convex:

```bash
npm test
```

They cover bucket selection, the IP hash, Retry-After seconds, a 429 from the Next guard, and fail-open when the component throws or the Convex URL is missing. Warnings in those tests must not contain the raw IP or the user key.

Before the component is deployed, call any AI route. It should succeed, and the server log should include `Rate limiter unavailable; allowing request`. No 429 is expected in that state.

After an approved deploy, send more requests than the bucket allows. The Next route should return 429 with `Retry-After`. The UI should show the wait, not a stack trace and not the plan upgrade modal.

## Covered

- `POST /api/chat`
- `POST /api/chat/retitle`
- `POST /api/resume/assist`
- `POST /api/template/generate`
- `POST /api/jobs/add`
- `POST /api/performance/summary`
- `POST /api/documents/generate-resume-pdf`
- `POST /api/free-resume/generate`
- Convex HTTP `POST /extension/saveJob` (before the OpenRouter parse)
- Email classification in `convex/emailAgent/poll.ts` and `convex/emailAgent/manualLead.ts`
- Resume tailoring and reply drafts in `convex/emailAgent/draft.ts`

Tools in `app/ai/tools/file.ts` and `extractResumeContent` run inside those HTTP requests. They are not limited a second time.

## Not covered

- LaTeX export and template switch (`/api/resume/export`, `/api/resume/switch-template`, `/api/coverletter/export`). They do not call a model.
- `GET /api/introduction`. It returns static JSON.
- Stripe, Gmail OAuth, and the agent HTTP routes that only read or write Convex data or call the LaTeX export.
- `convex/dopeAgents.ts`. It constructs an agent and does not export a Convex function, so nothing can call it.
- Archived clients under `clients/!!archived/`.
