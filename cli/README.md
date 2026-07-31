# jk — JobKompass CLI

Run your JobKompass job search from the terminal — or let an AI agent (Claude Code, Cursor, etc.) run it for you. Covers jobs, resumes, cover letters, email templates, resources, and chat threads.

## Setup
1. `npm install -g jobkompass-cli`
2. Create a key at [myjobkompass.com](https://www.myjobkompass.com) → **Settings → Command Line & AI Agents**. It's shown once — only a hash is stored.
3. `jk auth login <key>` (saved to `~/.config/jk/config.json`, mode 0600). Or set `JK_API_KEY`.

`JK_BASE_URL` overrides the target deployment (defaults to the live one).

## For agents
- Run `jk schema` once — it returns every route, param, and type as JSON.
- Output is JSON whenever stdout is piped. Exit codes: 0 ok, 1 your mistake (read `error.hint`), 2 server/network.
- Destructive commands need `--yes`. Nothing ever prompts.

## Examples
    jk jobs add --company "Anthropic" --title "Engineer" --link "https://..." --status Interested
    jk jobs list --status Applied
    jk jobs update --id <id> --status Interviewing --notes "phone screen Tue"
    jk resumes add --personal-info '{"firstName":"Joseph","lastName":"Wilson","email":"j@x.com","phone":"555-123-4567"}' --experience '[...]'
    jk resumes add --template mar --personal-info '{...}' --core-competencies '["Technical Support","Problem-Solving"]' --early-career '[{"title":"Process Engineer","company":"P&G","date":"2003 – 2007"}]'
    jk resumes list
    jk resources add --title "Salary guide" --url "https://..."

Resume templates: `jake` (default) or `mar` (Calibri-style, competencies-forward — use `--core-competencies` and `--early-career`). Run `jk resumes add --help` for all fields.

## Keys
A key carries full access to one account's data. Name each key after where it lives
(`laptop`, `claude-code`) so you can revoke just that one. Revoke from the same
Settings section — it takes effect immediately.

## Dev loop
    npm run build && npm link   # rebuild global binary
    npm test                    # unit tests
    JK_BASE_URL=<site> JK_API_KEY=<throwaway user key> npm run smoke

Admin key minting (bypasses the UI, for backfills) is internal-only:

    CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 \
      npx convex run agent/keys:generate '{"userId":"<userId>","name":"cli"}'

## Publishing
    cd cli && npm login && npm publish

`prepublishOnly` rebuilds and runs the tests first. Only `dist/` and this README ship.
