# Contributing to JobKompass

Thanks for taking a look. This page covers how to set the project up, how changes are named, and what has to pass before a pull request is reviewed.

No license has been published for this repository yet. If you plan to reuse the code outside of a contribution here, ask first.

## Before you start

- For anything larger than a small fix, open an issue first and describe what you want to change. It saves you from building something that will not be merged.
- Security problems do not go in issues. See [SECURITY.md](SECURITY.md).
- Be decent to people. See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

Full instructions, including the list of environment variables, are in the [README](README.md#getting-started). The short version:

```bash
npm install
npx convex dev   # terminal 1: your own Convex deployment
npm run dev      # terminal 2: http://localhost:3000
```

Use your own Convex project. Do not point a development machine at the live deployment, and do not run `npm run deploy:backend` or `npx convex deploy`. Backend deploys are done by the maintainer. The reason is in the [README](README.md#deploying).

The CLI is a separate package:

```bash
cd cli
npm install
npm run build
```

## Branches

`main` is the default branch. Work happens on a branch named for what it does:

- `feat/<short-name>` for a feature, for example `feat/resume-share-links`
- `fix/<short-name>` for a bug fix, for example `fix/gmail-poll-dead-message`
- `<project>/<area>` for a slice of a larger effort, for example `v4/jobs` and `v4/docs`, which were merged into `redesign/v4`

Keep a branch to one topic.

## Commits

The history uses two styles. Either is fine. Pick the one that reads best for the change.

Conventional prefix with an optional scope:

```
feat(cli): interview prep CRUD for agents
fix(tailor): read the first complete JSON object so a stray brace no longer fails every tailored resume
chore(convex): pin backend deploys to the live deployment
```

Or a plain sentence that starts with a verb or names the area:

```
Require a Plus plan for the Chrome extension endpoint
Stop mobile Safari zooming the page on input focus
Documents v4: card menu placement, folder phone layout, editor toasts
```

What matters more than the style:

- Say what changed and, when it is not obvious, why. "Fix bug" tells the next reader nothing.
- One logical change per commit.
- Specs and plans are committed as their own commits, with a `Spec:` or `Plan:` subject, under `docs/superpowers/`.

## Checks

All of these must pass:

```bash
npx tsc --noEmit
npm test
npm run build
```

If you changed anything under `cli/`:

```bash
cd cli
npm test
npm run build
```

`npm run lint` is not a gate. Next.js 16 removed `next lint`, and the `eslint .` script does not pass on this codebase yet. Do not try to make it pass as part of an unrelated change.

Add or update tests with your change. Unit tests sit next to the code as `*.test.ts`. Tests that span modules go in `tests/`.

## Design tokens

Components do not contain raw colours.

- No hex literals in `.tsx` files.
- No Tailwind palette classes such as `bg-blue-500` or `text-gray-700`.
- Colours come from the tokens defined in [`app/globals.css`](app/globals.css), for example `bg-background`, `text-muted-foreground`, `border-border`.

[`tests/design-tokens.test.ts`](tests/design-tokens.test.ts) enforces this. It is a ratchet: the allowed count of hex literals and palette classes is a ceiling that only goes down, and it is currently zero. A short allowlist in that file covers brand marks and third-party SVG art. If you need a colour that does not exist yet, add a token to `app/globals.css` for both themes and use that.

The app has a light and a dark theme. Check your change in both.

## Resume writing code

One rule is not negotiable: the resume writer never invents a number or a fact. It asks the person a question about the bullet and reuses the answer.

If you touch anything under `lib/resume/`, the chat tools in `app/ai/`, or any route that sends a resume to a model:

- Keep the output going through the fact guard in `lib/resume/noInventedFacts.ts`.
- Run `npm run test:no-invented-experience`.
- Do not weaken a check to make a test pass. If the checker is wrong, say so in the pull request and fix the checker.

Background is in the [README](README.md#the-writer-never-invents-a-fact) and in [`tests/no-invented-experience/README.md`](tests/no-invented-experience/README.md).

## Plans and paywalls

Plan rules live in `convex/plans.ts`. A new paywall is a rank comparison against that module, checked on the server. Do not gate a feature in the UI only.

## Pull requests

- Fill in the pull request template.
- Describe how you tested the change. Include screenshots for UI changes, at phone and desktop widths.
- Say whether the change touches `convex/`. Those changes need a backend deploy after merge, and the maintainer has to schedule it.
- Keep secrets out of the diff. `.env*` files are ignored by git. Keep it that way.

## Documentation

Docs are part of the change. If you add a route, a table, an environment variable or a plan gate, update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) or the [README](README.md) in the same pull request. Add a line to the "Unreleased" section of [CHANGELOG.md](CHANGELOG.md) for anything a user or an integrator would notice.
