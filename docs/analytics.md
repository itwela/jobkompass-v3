# Product analytics

JobKompass records a short list of product events with [PostHog](https://posthog.com) on the free plan. The browser SDK is `posthog-js`. Nothing is sent when `NEXT_PUBLIC_POSTHOG_KEY` is empty, so local builds and CI run without a PostHog account.

PostHog's free tier can start charging if usage passes the monthly allowance. After creating the project, set a **billing limit of $0** in the PostHog dashboard (Organization settings → Billing → billing limit). That is a dashboard step. The code cannot set it.

## Env vars

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | yes, to collect anything | Project API key (the public `phc_…` key). Leave unset to disable analytics. |
| `NEXT_PUBLIC_POSTHOG_HOST` | yes, once a key is set | Ingest host. US cloud: `https://us.i.posthog.com`. EU cloud: `https://eu.i.posthog.com`. |
| `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY` | no | Leave unset to record public marketing pages only. Set to `false` to turn replay off. There is no setting that records the app. |

Set the key and host in the hosting provider (Vercel) and in `.env.local` for local dev. Do not commit `.env.local`.

Create a PostHog project on the free plan, copy the project API key and the ingest host, and set the $0 billing limit before pointing production at it.

## Privacy

- Autocapture is off. `$autocapture` and `$dead_click` events are dropped before send, and `$el_text` / `$elements` are stripped if they appear on any event. Clicks do not send button text or typed input.
- Heatmaps are on for the whole app, including resume and editor screens. In posthog-js 1.435.8 a heatmap point is only `x`, `y`, `target_fixed`, and `type` (`click`, `mousemove`, `rageclick`, `deadclick`). It does not include an element selector, element text, or input value. The point is stored under the page URL, and that URL is rewritten to origin + path + `utm_*` before send. `session_id`, `email`, and other query params are removed.
- Session replay defaults to public marketing pages only. `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY=false` disables it. Inputs are masked, every text node is masked (`maskTextSelector: "*"`), element attributes are masked, and images, video, canvas, file inputs, and iframes are blocked. Network bodies are not recorded. Replay starts only after the route check, stops on the way into any other screen, and does not keep recording across a client-side navigation or a login that lands in the app.
- PostHog's free plan includes 5,000 session recordings a month. Set the **$0 billing limit** before leaving replay on, or set the env var to `false` if you do not want recordings to count.
- Event properties are an allowlist of ids, counts, booleans, and short slugs. Emails are replaced with `[redacted]`. Keys that look like a name, email, resume, content, token, or password are dropped. Strings longer than 300 characters are replaced, so a resume cannot ride along in a property.
- Page views keep the path and `utm_*` query params only.
- People are identified by the Convex user id after login. Email and name are not person properties.
- Do Not Track (`navigator.doNotTrack` of `1` or `yes`) and Global Privacy Control skip initialization entirely.
- There is no cookie banner. A visitor can opt out by setting `localStorage.jk_analytics_opt_out` to `1` and reloading. There is no in-app consent switch today.
- First-touch campaign data is stored in `localStorage` under `jk_first_touch_v1` and attached to the person once, at identify, so signup still has attribution after the landing query string is gone. The stored referrer is the host only (`news.ycombinator.com`), not the full URL. Those same fields are super properties on later events, including landing and pricing pageviews.

## Where session replay runs

Replay runs only when the PostHog key is set, the visitor has not opted out, and the path is in the allowlist. Login and client-side navigation call `stopSessionRecording()` as soon as the path leaves the list.

| Records | Does not record |
| --- | --- |
| `/` landing | `/app` and everything under it, including chat, documents, and the editor |
| `/pricing` | `/auth` |
| `/contact` | `/free-resume-generator` |
| `/privacy` | `/profile` |
| `/terms` | `/stripe` and `/stripe/success` |
| `/waitlist` | Any other path, including ones that contain `resume`, `document`, `editor`, or `chat` |

## Events

Super properties on every event, when they were present on the first visit: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `referrer_host`, `landing_path`. Use those on `$pageview` where `page_kind` is `landing` or `pricing` to see which post brought someone to the site.

| Event | When it fires | Properties |
| --- | --- | --- |
| `$pageview` | Every App Router navigation, including `/` and `/pricing` | `path`. `page_kind`: `landing`, `pricing`, or `other`. `$current_url` is origin + path + `utm_*` only. First-touch `utm_*` and `referrer_host` ride along as super properties. |
| `cta_clicked` | Landing "Get started" (`signup`) and "Try the free generator" links | `cta`: `signup` or `free_generator`. `surface`: `hero`, `header`, `midpage`, or `sticky`. `page_kind`. |
| `free_generator_started` | Free generator Generate click, once a template is chosen (includes the email gate) | `template_id` optional: `jake`, `joseph`, or `mar` |
| `free_generator_completed` | Free generator returns a PDF | `template_id` optional |
| `signup` | Password signup succeeds on `/auth` or the mobile sign-in popover. Once per browser session. | `method`: `password` |
| `first_resume_created` | Once per account when saved resumes go from 0 to 1, and once per browser for the free generator | `is_first`: `true`. `source`: `upload`, `paste`, `generated`, `chat`, `free_generator`, or `in_app`. `template_id` optional. No resume id, title, or body. |
| `resume_exported` | A resume PDF download or editor export succeeds | `method`: `download` or `export`. `format`: `pdf`. `template_id` optional. Cover letters and file names are not sent. |
| `upgrade_clicked` | An upgrade or pricing CTA is clicked, before Stripe | `surface`: `pricing`, `pricing_modal`, `upgrade_button`, `upgrade_modal`, `upgrade_prompt`, `header`, `sidebar`, `performance`, `settings`, or `search`. `authenticated`. `plan_id` optional. `interval` optional: `month`, `year`, or `one_time`. No price id or amount. |
| `checkout_started` | Stripe returns a checkout URL and the browser is about to redirect | `authenticated`: `true`. `plan_id` optional. `interval` optional. The Stripe URL and session id are not properties. |
| `paid_conversion` | Once on `/stripe/success` after Stripe redirects back | `source`: `checkout_success`. `plan_id` optional, from the success URL slug. `interval` optional. The Stripe session id is only a `sessionStorage` dedupe key. |

`upload` and `paste` are marked by My Documents import. A resume created from chat shows up as `in_app` when the account's resume list grows. Header and sidebar "Manage my plan" links are not `upgrade_clicked`. Unauthenticated pricing clicks are `upgrade_clicked` and then signup, not `checkout_started`.

## Error tracking

The same PostHog project records exceptions. No extra env vars. With no project key, nothing is sent.

- Browser: `capture_exceptions` records uncaught errors and unhandled promise rejections. `console.error` is not captured.
- React: `app/error.tsx` and `app/global-error.tsx` call `captureException` for render errors. The page shows a generic message and, when Next provides one, an error digest. It does not show `error.message`.
- Server: `instrumentation.ts` `onRequestError` runs in the Node.js runtime and sends the exception through `posthog-node`. Properties are `source`, `path` (no query string), `method`, `router_kind`, `route_path`, and `route_type`. The PostHog cookie is read only to copy `distinct_id`. Cookies, authorization headers, and request bodies are not sent.

Exception messages longer than 180 characters are replaced. Emails in a message or stack are replaced with `[redacted]`. Source context lines from a stack (`context_line`, `pre_context`, `post_context`) are dropped.

PostHog's free tier includes error tracking up to its monthly quota. The same **$0 billing limit** in the PostHog dashboard covers this, so an overage cannot charge the card.

Sentry's free developer plan is the alternative if you want a separate error tracker. This repo does not install Sentry. Stay on PostHog unless you deliberately switch.

## What is intentionally not collected

Resume text, cover letter text, job descriptions, names, emails, usernames, file names, prompts, and raw Stripe customer or session ids.
