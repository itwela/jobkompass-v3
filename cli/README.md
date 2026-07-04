# jk — JobKompass CLI

Agent-first CLI for JobKompass (jobs, resumes, cover letters, email templates, resources, threads).

## Setup
1. Get an API key (in the jobkompass-v3 repo — the live deployment is `proficient-mammoth-632`):
   `CONVEX_DEPLOYMENT=dev:proficient-mammoth-632 npx convex run agent/keys:generate '{"userId":"<userId>","name":"cli"}'`
2. `jk auth login <key>` (stored in ~/.config/jk/config.json). Or set `JK_API_KEY`.
3. `JK_BASE_URL` overrides the target deployment (defaults to the live one).

## For agents
- Run `jk schema` once — it returns every route, param, and type as JSON.
- Output is JSON whenever stdout is piped. Exit codes: 0 ok, 1 your mistake (read error.hint), 2 server/network.
- Destructive commands need `--yes`. Nothing ever prompts.

## Examples
    jk jobs add --company "Anthropic" --title "Engineer" --link "https://..." --status Interested
    jk jobs list --status Applied
    jk jobs update --id <id> --status Interviewing --notes "phone screen Tue"
    jk resumes list
    jk resources add --title "Salary guide" --url "https://..."

## Dev loop
    npm run build && npm link   # rebuild global binary
    npm test                    # unit tests
    JK_BASE_URL=<site> JK_API_KEY=<throwaway user key> npm run smoke
