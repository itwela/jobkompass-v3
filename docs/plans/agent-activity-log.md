# Agent activity log

Goal: every time an agent changes data through the Agent API, or does something outside JobKompass
(sends an email, posts a Slack message), it leaves a row saying who it was, which model it ran on,
what it did and how it went. Later analytics compare models by action type.

## Identity (never guessed)

| Source | Name | Agent ID | Model | Provider |
|---|---|---|---|---|
| HTTP header | `X-Agent-Name` | `X-Agent-Id` | `X-Agent-Model` | `X-Agent-Provider` |
| CLI flag (global) | `--agent <name>` | `--agent-id <id>` | `--model <model>` | `--provider <p>` |
| CLI env fallback | `JK_AGENT_NAME` | `JK_AGENT_ID` | `JK_AGENT_MODEL` | `JK_AGENT_PROVIDER` |

Flag beats env. The CLI only sends a header when it has a value. On the server a missing or blank header is
stored as `"unknown"`. Nothing is inferred from the User-Agent, the key name or anything else.
Values are trimmed, capped at 120 chars and scrubbed like summaries.

## Schema: `agentActivityLog`

```
userId: string            // owner (from the API key, never from the request)
timestamp: number         // ms
agentName, agentId, model, provider: string   // "unknown" when not sent
actionType: string        // e.g. resumes.generate, jobs.create, email_sent
source: "api" | "external"
route?: string            // "POST /agent/resumes/generate" for automatic rows
target?: string           // recipient / thread id / document id, scrubbed, <= 200 chars
summary: string           // scrubbed, <= 280 chars
status: "success" | "error"
errorMessage?: string     // scrubbed, <= 280 chars
latencyMs?, inputTokens?, outputTokens?, costUsd?: number
bodyHash?: string         // sha256 hex supplied by the caller, never the body
```

Indexes: `by_user_time [userId, timestamp]`, `by_user_agent [userId, agentName, timestamp]`,
`by_user_model [userId, model, timestamp]`, `by_user_action [userId, actionType, timestamp]`.

Only a new table: no existing table or row changes, no migration.

## Automatic logging (dispatch.ts)

`makeHandler` already funnels every route. After authentication, for every route whose method is not GET
(i.e. POST / PATCH / DELETE: job add/update/delete, resume generate/tailor/update/rename/share/duplicate/
delete/move/answers, cover letter generate/duplicate/delete/move, email templates, resources, interview preps),
it times the call and records one row with status success or error (error message = the error the client gets).
`POST /agent/activity` itself is not auto-logged (it is the log). GETs (list, get, search, questions) are never logged.

- actionType is derived from the route: `<noun>.<verb>`; explicit sub-path wins
  (`POST /agent/resumes/generate` -> `resumes.generate`), otherwise POST -> `create`, PATCH -> `update`,
  DELETE -> `delete` (`PATCH /agent/jobs` -> `jobs.update`).
- target: `id`, then `base`, then `jobId`, then `folder` from the args, else `id` from the result.
- summary: the route's description, truncated.
- Recording is wrapped in try/catch and happens after the response is computed; a logging failure is
  swallowed (console.error) and the original response (success or error) is returned unchanged.

## Endpoints

- `POST /agent/activity` (`activityLog`): `actionType` (required, `[a-z0-9_.-]`, <= 64), `target`, `summary` (required),
  `status` (success|error, default success), `errorMessage`, `latencyMs`, `inputTokens`, `outputTokens`, `costUsd`,
  `bodyHash` (must be 64 hex chars). Returns `{id, timestamp, agentName, agentId, model, provider, actionType, status}`.
  Fields named `body`, `content`, `token`, `password` (also `apiKey`, `secret`, `message`, `text`) are rejected
  with 400 `forbidden_field` before anything else, and the hint points at `bodyHash`.
- `GET /agent/activity` (`activityList`): filters `agent`, `agentId`, `model`, `actionType`, `status`, `from`, `to`
  (ISO date or ms), `limit` (1-200, default 50), `cursor`. Uses the most selective index
  (agent > model > actionType > time), timestamp range on the index, remaining filters in `.filter`, newest first,
  Convex `paginate`. Returns `{items, cursor, isDone}`.
- `GET /agent/activity/summary` (`activitySummary`): same filters minus pagination; scans up to 5000 rows in range.
  Returns `{total, truncated, byModel:[{model,provider,count,success,error,successRate,avgLatencyMs}], byActionType:[...],
  byModelAndAction:[...]}`.

All three go through the same route table, `buildArgs` validation, auth (Pro plan) and error envelope as every
other route. Every query is scoped to the caller's `userId` via the indexes.

## Redaction (convex/agent/activityLog.ts, pure, unit-tested)

`scrub(text)` replaces with `[redacted]`: `Bearer <x>`, `sk-...`/`pk_...`/`rk_...`/`ghp_...`/`xox?-...`/`AKIA...`
style keys, JWTs, `key=value` pairs whose key looks like token/secret/password/api_key, hex runs >= 32 chars,
base64-ish runs >= 40 chars. Then collapse whitespace and truncate (summary/error 280, target 200, identity 120).

## CLI (0.4.0 -> 0.5.0)

- Global options `--agent`, `--agent-id`, `--model`, `--provider` + env fallbacks; `client.ts` sends `X-Agent-*`.
  `agentHeaders(opts, env)` is a pure, tested function.
- `jk activity log --type <t> --target <x> --summary <s> [--status] [--error] [--latency-ms] [--input-tokens]
  [--output-tokens] [--cost-usd] [--body-hash]`
- `jk activity list [--filter-agent] [--filter-agent-id] [--filter-model] [--type] [--status] [--from] [--to] [--limit] [--cursor]`
  (`--agent`, `--agent-id` and `--model` are the global identity flags, so the filters carry a `filter-` prefix.)
- `jk activity summary` with the same filters; pretty output renders the per-model and per-action tables.
- README: new "Activity log" section with flags and env vars.

## Tests

- `convex/agent/activityLog.test.ts`: identity from headers (missing -> unknown, blanks, trimming, no inference),
  scrubbing (bearer, sk-, JWT, hex, base64, key=value), truncation, forbidden field detection, actionType derivation
  for every non-GET route, which routes are logged, target picking, bodyHash validation, summary aggregation,
  and `recordSafely` never throwing when the writer throws.
- `cli/test/commands.test.ts`: activity commands map to the right routes/params; `cli/test/agent.test.ts`:
  flag > env > absent, header names.
- Gate: `npx tsc --noEmit`, root `npx vitest run`, `cli` `npx vitest run` + `npx tsc --noEmit`.
