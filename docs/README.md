# Documentation

Everything under `docs/`, plus the documents that live next to the code they describe.

## Start here

- [ARCHITECTURE.md](ARCHITECTURE.md): how the app, the backend, the CLI and the extension fit together
- [../README.md](../README.md): what JobKompass is, how to run it, how to deploy it
- [../CONTRIBUTING.md](../CONTRIBUTING.md): setup, conventions and the checks to run
- [../CHANGELOG.md](../CHANGELOG.md): what changed and when

## Reference

- [rate-limiting.md](rate-limiting.md): AI rate limits, buckets, and how to tune them
- [analytics.md](analytics.md): what PostHog records and how to turn it off
- [../cli/README.md](../cli/README.md): the `jk` CLI
- [../lib/INPUT_SECURITY.md](../lib/INPUT_SECURITY.md): input sanitization
- [../tests/no-invented-experience/README.md](../tests/no-invented-experience/README.md): the regression suite for the no-invented-facts rule

## Guides

Step-by-step records of how each piece was first set up. They were written at the time and can trail the code. When a guide and the code disagree, the code is right.

- [guides/convex-auth-setup.md](guides/convex-auth-setup.md): Convex Auth with the password provider
- [guides/stripe-setup.md](guides/stripe-setup.md): Stripe checkout, portal and webhook
- [guides/latex-service-setup.md](guides/latex-service-setup.md): the LaTeX compile service behind PDF export
- [guides/openai-agents-setup.md](guides/openai-agents-setup.md): the chat agent and its tools
- [guides/free-resume-generator.md](guides/free-resume-generator.md): the free resume generator
- [guides/resume-information-guide.md](guides/resume-information-guide.md): how resume data is structured and normalized

## Notes

Planning notes kept for history. They are not a roadmap and some describe work that has since shipped or been dropped.

- [notes/new-features-to-add.md](notes/new-features-to-add.md): early feature ideas
- [notes/personalization-feature-prompt.md](notes/personalization-feature-prompt.md): the brief for the Performance screen
- [notes/product-hunt-posters.md](notes/product-hunt-posters.md): launch poster briefs
- [notes/code-pointers.md](notes/code-pointers.md): old pointers into the code, formerly `TABLE-OF-CONTENTS.md` at the repo root

## Specs and plans

Design specs and implementation plans, one pair per feature, named by date.

- [superpowers/specs/](superpowers/specs/)
- [superpowers/plans/](superpowers/plans/)

These files moved out of the repo root into `docs/guides/` and `docs/notes/`:

| Old path | New path |
| --- | --- |
| `CONVEX_AUTH_SETUP_GUIDE.md` | `docs/guides/convex-auth-setup.md` |
| `STRIPE_SETUP.md` | `docs/guides/stripe-setup.md` |
| `LATEX_SERVICE_SETUP.md` | `docs/guides/latex-service-setup.md` |
| `OPENAI_AGENTS_SETUP_GUIDE.md` | `docs/guides/openai-agents-setup.md` |
| `FREE_RESUME_PARSER_GENERATOR.md` | `docs/guides/free-resume-generator.md` |
| `JOBKOMPASS_RESUME_INFORMATION_GUIDE.md` | `docs/guides/resume-information-guide.md` |
| `new-features-to-add.md` | `docs/notes/new-features-to-add.md` |
| `PERSONALIZATION_FEATURE_MASTER_PROMPT.md` | `docs/notes/personalization-feature-prompt.md` |
| `product-hunt-posters.md` | `docs/notes/product-hunt-posters.md` |
| `TABLE-OF-CONTENTS.md` | `docs/notes/code-pointers.md` |
