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
Resumes can be filed into the same folders you see in Documents (one folder per resume).
Moving only changes the folder: content is never touched and nothing is deleted.

    jk folders list                                                     # id, name, resumeCount, coverLetterCount
    jk resumes move --folder "archived resumes" --ids <id1>,<id2>       # moves right away (--dry-run to preview)
    jk resumes move --folder "archived resumes" --all-except-favorites  # DRY RUN: lists what would move
    jk resumes move --folder "archived resumes" --all-except-favorites --yes   # actually moves

`--folder` takes an id or an exact name (case-insensitive); an unknown or ambiguous name is an error, so pass the id.
`--all-except-favorites` selects every resume not starred as a favorite and is always a dry run unless `--yes`.
Returns `{dryRun, folder, moved, skipped, alreadyInFolder, counts: {moved, skipped, alreadyInFolder, total}}`;
on a dry run `moved` lists what would move. Favorites and ids that aren't yours come back in `skipped` with a reason.

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
