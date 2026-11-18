# Security

## Reporting a vulnerability

Please do not open a public issue, pull request or discussion for a security problem.

Report it privately through GitHub:

1. Go to the [Security tab](https://github.com/itwela/jobkompass-v3/security) of this repository.
2. Choose "Report a vulnerability". This opens a private security advisory that only the maintainers can see.

If that option is not available to you, open a regular issue that says only that you have a security report and need a private channel. Do not include any detail in it.

A useful report has:

- what you found and where (route, function or file)
- the steps to reproduce it
- what an attacker could do with it
- any data you accessed that was not yours

## What to expect

JobKompass is maintained by a very small team. There is no bug bounty and no guaranteed response time. Reports are read, and valid ones are fixed before details are made public. You will be credited in the advisory if you want to be.

## Scope

In scope:

- the web app at <https://www.myjobkompass.com>
- the agent API under `/agent/*` and the `jk` CLI
- the extension endpoint `/extension/saveJob`
- the code in this repository

Please do not:

- test against accounts or data that are not yours
- run automated scanners or load tests against the live site
- use social engineering against the maintainers or users

The live site, the CLI and the extension share one production backend. There is no separate staging environment, so careless testing affects real users.

## Supported versions

Only the current deployment of the site and the latest published version of `jobkompass-cli` receive fixes.

## How credentials are handled

A few facts that are useful when assessing a report. Each can be checked in the code.

- **CLI and agent API keys** are shown once when created. Only a SHA-256 hash is stored (`convex/agent/keys.ts`, table `agentApiKeys`), and a lookup compares hashes (`convex/agent/auth.ts`). Revoking a key takes effect immediately.
- **The CLI** saves its key to `~/.config/jk/config.json` with file mode 0600, or reads it from `JK_API_KEY`.
- **A CLI key** carries full access to one account's data. Name each key after where it lives so one can be revoked without the others.
- **Agent API functions** take the user id resolved from the key, never one sent in the request, and check ownership of each row (`convex/agent/fns.ts`).
- **API routes** resolve the caller from the Convex Auth session token, not from a user id in the request body.
- **Rate-limit keys** for logged-out callers are built from a hash of the IP address. The raw address is not stored or logged. See [docs/rate-limiting.md](docs/rate-limiting.md).
- **Secrets** are read from environment variables. `.env*` files are ignored by git.

## If you find a secret in the repository

Treat it as a vulnerability and report it privately as above. Do not use it and do not post it.
