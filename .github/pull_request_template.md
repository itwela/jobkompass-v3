## What this changes

A short description of the change and why it is needed. Link the issue if there is one.

## How it was tested

What you ran and what you looked at. For UI changes, add screenshots at phone and desktop widths, in both themes.

## Checks

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] In `cli/`, if the CLI changed: `npm test` and `npm run build`

`npm run lint` is not a gate in this repo. See CONTRIBUTING.md.

## Checklist

- [ ] No hex literals or Tailwind palette classes in components. Colours come from the tokens in `app/globals.css`.
- [ ] Resume writing changes still pass through the fact guard, and `npm run test:no-invented-experience` passes.
- [ ] New paywalls are checked on the server against `convex/plans.ts`.
- [ ] No secrets, API keys or real personal data in the diff.
- [ ] Docs and `CHANGELOG.md` are updated where the change is visible to users or integrators.

## Backend

- [ ] This change touches `convex/` and needs a backend deploy after merge.

Do not run `npm run deploy:backend` or `npx convex deploy` yourself. The maintainer deploys the backend.
