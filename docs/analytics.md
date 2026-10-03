# Product analytics

JobKompass records a short list of product events with [PostHog](https://posthog.com) on the free plan. The browser SDK is `posthog-js`. Nothing is sent when `NEXT_PUBLIC_POSTHOG_KEY` is empty, so local builds and CI run without a PostHog account.

PostHog's free tier can start charging if usage passes the monthly allowance. After creating the project, set a **billing limit of $0** in the PostHog dashboard (Organization settings → Billing → billing limit). That is a dashboard step. The code cannot set it.

## Env vars

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | yes, to collect anything | Project API key (the public `phc_…` key). Leave unset to disable analytics. |
| `NEXT_PUBLIC_POSTHOG_HOST` | yes, once a key is set | Ingest host. US cloud: `https://us.i.posthog.com`. EU cloud: `https://eu.i.posthog.com`. |
| `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY` | no | Leave unset. Session replay stays off. Set to exactly `true` only if you accept masked replay (see below). |

Set the key and host in the hosting provider (Vercel) and in `.env.local` for local dev. Do not commit `.env.local`.

Create a PostHog project on the free plan, copy the project API key and the ingest host, and set the $0 billing limit before pointing production at it.

## Privacy

- Session replay is **off**. `disable_session_recording` is true, and the app calls `stopSessionRecording()` after init.
- If `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY=true`, replay still masks every input, every text node, and element attributes. File inputs and iframes are blocked. Network bodies are not recorded. Replay is stopped on `/app` (the console, where resumes and documents are edited), `/free-resume-generator`, `/auth`, `/profile`, `/stripe`, and any path containing `resume`, `document`, or `editor`.
- Autocapture is off, so clicks do not send button text or the name written on the page.
- Event properties are an allowlist of ids, counts, booleans, and short slugs. Emails are replaced with `[redacted]`. Keys that look like a name, email, resume, content, token, or password are dropped. Strings longer than 500 characters are replaced, so a resume cannot ride along in a property.
- Page views keep the path and `utm_*` query params only. `session_id`, `email`, and other query params are not sent.
- People are identified by the Convex user id after login. Email and name are not person properties.
- Do Not Track (`navigator.doNotTrack` of `1` or `yes`) and Global Privacy Control skip initialization entirely.
- There is no cookie banner. A visitor can opt out by setting `localStorage.jk_analytics_opt_out` to `1` and reloading. There is no in-app consent switch today.
- First-touch campaign data is stored in `localStorage` under `jk_first_touch_v1` and attached to the person once, at identify, so signup still has attribution after the landing query string is gone. The stored referrer is the host only (`news.ycombinator.com`), not the full URL.

## Events

Super properties on every event, when they were present on the first visit: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `referrer_host`, `landing_path`.

### `$pageview`

Fired on App Router navigations.

| Property | Meaning |
| --- | --- |
| `path` | Pathname, no query string |
| `$current_url` | Origin + pathname + `utm_*` params only |

### `signup`

Fired once per browser session after a successful password signup (`/auth` and the mobile sign-in popover).

| Property | Meaning |
| --- | --- |
| `method` | Always `password` |

### `first_resume_created`

Fired once per account when the saved resume count goes from 0 to 1, and once per browser for the free resume generator.

| Property | Meaning |
| --- | --- |
| `is_first` | Always `true` |
| `source` | `upload`, `paste`, `generated`, `chat`, `free_generator`, or `in_app` |
| `template_id` | Optional. `jake`, `joseph`, or `mar` |

`upload` and `paste` are marked by My Documents import. The free generator uses `free_generator`. A resume created from chat or another in-app path shows up as `in_app` when the account's resume list grows, because those saves do not carry a separate source flag. The event does not include the resume id, title, or body.

### `resume_exported`

Fired after a resume PDF download or export succeeds.

| Property | Meaning |
| --- | --- |
| `method` | `download` (saved file) or `export` (editor export) |
| `format` | Always `pdf` |
| `template_id` | Optional. `jake`, `joseph`, or `mar` |

Cover letters are not included. File names are not sent.

### `upgrade_clicked`

Fired when someone clicks an upgrade or checkout CTA.

| Property | Meaning |
| --- | --- |
| `surface` | `pricing`, `pricing_modal`, `upgrade_button`, `upgrade_modal`, `upgrade_prompt`, `header`, `sidebar`, `performance`, `settings`, or `search` |
| `authenticated` | Whether they were signed in |
| `plan_id` | Optional. `starter`, `plus`, `plus-annual`, `pro`, `pro-annual` |
| `interval` | Optional. `month`, `year`, or `one_time` |

Header and sidebar "Manage my plan" links are not counted. Price ids and amounts are not sent.

### `paid_conversion`

Fired once on `/stripe/success` after Stripe redirects back with a `session_id`. That is the existing checkout success page. The Stripe webhook still writes the subscription; this event is the browser-side conversion so it keeps the visitor's first-touch properties.

| Property | Meaning |
| --- | --- |
| `source` | Always `checkout_success` |
| `plan_id` | Optional plan slug, from the success URL (not the Stripe session) |
| `interval` | Optional. `month`, `year`, or `one_time` |

The Stripe session id is not a property. It is only used in `sessionStorage` so a refresh does not count twice.

Checkout appends `plan` and `interval` to the success URL. Those values are the same slugs the app already stores on a subscription. They are not price ids.

## What is intentionally not collected

Resume text, cover letter text, job descriptions, names, emails, usernames, file names, prompts, and raw Stripe customer or session ids.
