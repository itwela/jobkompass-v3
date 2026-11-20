# jk — JobKompass CLI

Run your JobKompass job search from the terminal — or let an AI agent (Claude Code, Cursor, etc.) run it for you. Covers jobs, resumes, cover letters, email templates, resources, and chat threads.

## Setup
1. `npm install -g jobkompass-cli`
2. Create a key at [myjobkompass.com](https://www.myjobkompass.com) → **Settings → Command Line & AI Agents**. It's shown once — only a hash is stored.
3. `jk auth login <key>` (saved to `~/.config/jk/config.json`, mode 0600). Or set `JK_API_KEY`.

`JK_BASE_URL` overrides the target deployment (defaults to the live one).

## For agents
- Run `jk schema` once — it returns every route, param, and type as JSON, plus `workflows.resumeQuestions` (the never-invent-a-number flow).
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

## Folders
Resumes and cover letters can be filed into the same folders you see in Documents (one folder per document).
Moving only changes the folder: content is never touched and nothing is deleted.

    jk folders list                                                     # id, name, resumeCount, coverLetterCount
    jk resumes move --folder "archived resumes" --ids <id1>,<id2>       # moves right away (--dry-run to preview)
    jk resumes move --folder "archived resumes" --all-except-favorites  # DRY RUN: lists what would move
    jk resumes move --folder "archived resumes" --all-except-favorites --yes   # actually moves

`--folder` takes an id or an exact name (case-insensitive); an unknown or ambiguous name is an error, so pass the id.
`--all-except-favorites` selects every resume not starred as a favorite and is always a dry run unless `--yes`.
Returns `{dryRun, folder, moved, skipped, alreadyInFolder, counts: {moved, skipped, alreadyInFolder, total}}`;
on a dry run `moved` lists what would move. Favorites and ids that aren't yours come back in `skipped` with a reason.

Cover letters work the same way:

    jk coverletters move --folder "Archive - Cover Letters" --ids <id1>,<id2>            # moves right away (--dry-run to preview)
    jk coverletters move --folder "Archive - Cover Letters" --all                        # DRY RUN: every letter not already in the folder
    jk coverletters move --folder "Archive - Cover Letters" --all --unfiled-only         # DRY RUN: only letters in no folder yet
    jk coverletters move --folder "Archive - Cover Letters" --all --unfiled-only --yes   # actually moves

`--all` is always a dry run unless `--yes`. Letters already in the folder come back in `alreadyInFolder`;
with `--unfiled-only`, letters filed in another folder come back in `skipped` as `in_other_folder`.
Same result shape as `jk resumes move`.

## Activity log
Every command that changes data (add, update, delete, generate, tailor, move...) leaves a row in your activity log
with who did it, which model, the action, its target, status and latency. Reads (list, get, questions) are not logged.
Tell JobKompass who you are with global flags or env vars (flags win). Anything not set is stored as `unknown`;
nothing is ever guessed.

| Flag | Env var | Header sent |
|---|---|---|
| `--agent <name>` | `JK_AGENT_NAME` | `X-Agent-Name` |
| `--agent-id <id>` | `JK_AGENT_ID` | `X-Agent-Id` |
| `--model <model>` | `JK_AGENT_MODEL` | `X-Agent-Model` |
| `--provider <p>` | `JK_AGENT_PROVIDER` | `X-Agent-Provider` |

    export JK_AGENT_NAME=Summit JK_AGENT_MODEL=claude-opus-5-5 JK_AGENT_PROVIDER=anthropic
    jk jobs add --company Acme --title Engineer --link https://... --status Applied     # logged as jobs.create

Log something you did outside JobKompass (an email through Gmail, a Slack message):

    jk activity log --type email_sent --target jane@acme.com --summary "Follow-up on Staff Engineer application" \
      --latency-ms 820 --input-tokens 1200 --output-tokens 300 [--status error --error "SMTP 550"] [--body-hash <sha256>]

Never send the message itself. Summaries are cut to 280 chars and targets to 200, and obvious secrets (bearer tokens,
API keys, long hex/base64 strings, `password=...`) are replaced with `[redacted]`. Fields named `body`, `content`,
`token` or `password` are rejected; pass `--body-hash` (sha256 hex of what you sent) if you need a fingerprint.

    jk activity list [--filter-agent Summit] [--filter-agent-id <id>] [--filter-model claude-opus-5-5] [--type email_sent] \
      [--status error] [--from 2026-11-01] [--to 2026-11-30] [--limit 50] [--cursor <cursor>]
    jk activity summary [same filters]   # count, success rate, avg latency by model, by action type, by both

`list` returns `{items, cursor, isDone}`; pass `--cursor` for the next page. The filters carry a `filter-` prefix
because `--agent`, `--agent-id` and `--model` are the identity flags.

## Keys tied to an agent
Flags and env vars are self-reported. To make the name stick, give each agent its own key with an identity. Every call
made with that key is logged under that identity, and request headers can't override it.

The model on each action comes from: the key's model, else `--model` / `JK_AGENT_MODEL` (sent as `X-Agent-Model`),
else `model` in a raw `POST /agent/activity` body, else `unknown model`. `jk keys create` warns when `--model` is missing.

    jk keys create --name laptop --agent "Claude Code" --model claude-opus-5-5 --provider anthropic [--agent-id cc-laptop]
    jk keys list                       # name, identity, created, last used. Never the key itself
    jk keys revoke --id <id> --yes     # add --self to revoke the key this CLI is using

The new key is printed once. A key tied to an agent can't create keys, so a leaked agent key can't make more.
You can also create keys and edit their identity in JobKompass under Settings → CLI keys. Editing an identity doesn't
change past activity. `jk auth status` warns when the configured key has no identity.

Each row records where its identity came from (`identitySource`: `key`, `header` or `none`), the key's name, and the
client (`jk/0.6.0`).

## Resume questions: never invent a number
Strong bullets carry numbers. Only the human knows them, so the API asks instead of guessing.

    jk resumes questions --id <baseResumeId> [--job <jobId>] [--ai]   # before writing
    jk resumes answer --id <baseResumeId> --answers '[{"id":"<question id>","answer":"about 40 a day"}]'
    jk resumes get --id <baseResumeId>                                 # shows saved bulletAnswers
    jk resumes add ... --job <jobId> [--ai-questions]                  # response: questions + scorecard
    jk resumes tailor --base <resumeId> --job <jobId> [--template mar] [--instructions "lead with the data work"]
                                                                       # server writes it, using saved answers

`resumes add` / `update` return `{id, name, fileUrl, questions, questionSource, scorecard, rule}`.
Questions are built-in by default (free, instant); `--ai-questions` / `--ai` asks the model instead and never rewrites
your content. Relay questions to your human, save their answers with `jk resumes answer`, and every later resume reuses them.

`resumes tailor` saves the same result as tailoring in the app: your saved resume preferences plus `--instructions`,
your default template (unless `--template`), the app's document name, the "what changed" marks and must-haves shown in
Documents, and the job's `resumeUsed`. Passing an already-tailored resume as `--base` writes from the original base it
came from, with that base's saved answers. The raw API also takes `preferences` (a JSON array) to replace the saved ones.
If `--template` is above your plan, tailoring still runs with `jake` and prints a notice (the `notice` field in `--json`)
instead of failing.

Resume templates: `jake` (default), `joseph` (Calibri-style, competencies-forward: use `--core-competencies` and `--early-career`) or `mar` (Times serif, categorized skills). Joseph and Mar need a paid plan. Run `jk resumes add --help` for all fields.

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
