# Agent identity

Goal: reliably detect and name the agent behind every call on a JobKompass account. The answer comes from
the key the caller authenticated with, not from what it says about itself.

Decision (Itwela, Nov 19): "The feature is agent activity, not human activity." Every `/agent/*` call is an
agent call by definition. Calls with no identity show as "Unknown agent". Nothing else is tracked.

## Where we are (read from the code)

- `authenticate()` (`convex/agent/auth.ts`) hashes the Bearer key; `keys.lookupByHash` returns `{userId, keyId}`.
  `makeHandler` (`convex/agent/dispatch.ts`) then calls `identityFromHeaders()` (`convex/agent/activityLog.ts`):
  `X-Agent-Name/Id/Model/Provider`, missing -> `"unknown"`.
- CLI `agentHeaders()` (`cli/src/agent.ts`) sends those headers from `--agent/--agent-id/--model/--provider`, else
  `JK_AGENT_*`. Config (`cli/src/config.ts`) stores `apiKey` and `baseUrl` in `~/.config/jk/config.json` (0600).
- Logged: non-GET `/agent/*` routes (`shouldAutoLog`) and `POST /agent/activity`.
- `agentApiKeys`: `userId, name, keyHash, createdAt, lastUsedAt?, revokedAt?`. No identity, and the log does not
  record which key was used.
- Keys are minted only on the web (`keys.generateMine`, `listMine`, `revokeMine`; UI in
  `jkChatWindow-SettingsMode.tsx`). No `jk keys` command.
- Agent Activity page: `jkChatWindow-AgentActivityMode.tsx` + `app/jk-components/jk-agent-activity/*`, fed by
  `convex/agent/activity.ts` (`listMine`, `summaryMine`).

The gap: identity is self-reported per request, often `unknown`, and spoofable.

## 1. Agent-scoped keys

Schema `agentApiKeys`: add optional `agentName`, `agentId`, `model`, `provider` (strings, `clean(_, IDENTITY_MAX)`).
Optional, so legacy keys keep working unchanged.

Schema `agentActivityLog`: add optional `keyId: v.id("agentApiKeys")`, `identitySource`
(`"key" | "header" | "profile" | "none"`), `client` (truncated `User-Agent`, display only). Existing rows validate;
no backfill, no new index.

`keys.lookupByHash` returns `{userId, keyId, keyName, identity}`. `authenticate()` returns that object instead of a
bare string (callers: `makeHandler`, `/agent/ping`, `/agent/schema`).

## 2. Server identity precedence

New pure fn `resolveIdentity(keyIdentity, headers)` in `activityLog.ts`:

- Field set on the key: key wins, header ignored and not stored. `identitySource: "key"`.
- Field not set on the key: header fills it (`"header"`, or `"profile"` when the CLI sends `X-Agent-Source: profile`).
- Nothing anywhere: `"unknown"`, `identitySource: "none"`, shown as "Unknown agent".
- Open: may a header add model detail? Proposal: only when the key's model is a prefix of the header value
  (key `claude-sonnet`, header `claude-sonnet-5-5`). Agent name, id and provider never come from a header on a scoped key.

## 3. Key routes and `jk keys`

- `POST /agent/keys` -> `jk keys create --name <n> --agent <name> --model <m> --provider <p> [--agent-id <id>]`.
  `keys.createFromAgent` (internalAction). A scoped key cannot mint keys (a compromised agent can't fan out).
  The plaintext key is shown once, never logged, never in the activity row (`target` = new key id).
- `GET /agent/keys` -> `jk keys list`: name, identity, created, last used. Never hash or key.
- `DELETE /agent/keys` -> `jk keys revoke <id>`: own keys only; refuses the key making the call unless `--self`.
- Web: `keys.generateMine` gains the four identity args; new `keys.updateMine` (owner check like `revokeMine`) edits
  identity. Editing identity does not rewrite past rows.

## 4. `jk agent login / logout` (later convenience)

`jk agent login --name <n> --model <m> --provider <p> [--agent-id <id>]` writes `agentProfile` into the existing
config; `logout` removes it; `status` prints it. `agentHeaders()` order: flag > env > profile. Stores only the four
identity strings, no secret. Still self-reported: the server records `identitySource: "profile"` and a scoped key
overrides it. About 60 lines + tests.

## "Unknown agent" handling

- Rows with no identity group under one "Unknown" agent (feed, By agent card, filters).
- Nudges to scope keys: Unknown card ("Scope a key to name this agent"), details panel hint + "Scope this key"
  button on legacy-key rows, Settings "Add identity" link on keys without identity, banner when all rows are unknown.
- `/agent/ping` returns `{userId, app, key: {name, scoped, identity}}`; `jk auth status` warns on an unscoped key.

## API surface

- `GET /agent/activity` rows gain `keyName`, `identitySource`, `client`. Summary unchanged in shape.
- `POST /agent/activity` response gains `identitySource`.
- New `POST/GET/DELETE /agent/keys` (in `routes.ts`, logged as `keys.*`).
- `/agent/schema` documents precedence under `auth`.

## CLI (0.5.0 -> 0.6.0)

`cli/src/agent.ts` (profile layer, `X-Agent-Source`, `User-Agent: jk/<version>`), `cli/src/config.ts`
(`agentProfile`), `cli/src/index.ts` (`keys create|list|revoke`, later `agent login|logout|status`),
`cli/src/output.ts` (Agent column: name + identity source), README.

## Tests

- `convex/agent/activityLog.test.ts`: `resolveIdentity` matrix (key only, header only, both differ -> key, model
  detail rule, none -> unknown); `keyId` and `identitySource` stored; old rows read fine.
- New `convex/agent/keys.test.ts`: scoped key round trip, scoped key cannot mint keys, revoke own only, list never
  returns hash, plaintext absent from the activity row.
- `cli/test/agent.test.ts`: flag > env > profile; login/logout leave `apiKey` untouched.
  `cli/test/commands.test.ts`: keys commands map to routes.
- Gate: `npx tsc --noEmit`, root `npx vitest run`, `cli` `npx vitest run` + `npx tsc --noEmit`.

## Migration and deploy order

1. Schema (optional fields) + `auth.ts`, `keys.ts`, `activityLog.ts`, `dispatch.ts`, `fns.ts`, `activity.ts`, tests.
2. Key routes (`routes.ts`, `keys.ts`), tests.
3. **Deploy Convex to prod.** No backfill: legacy keys resolve exactly as today.
4. UI (after FigCraft sign-off).
5. **Publish CLI 0.6.0 only after step 3 is live** (new commands 404 otherwise). Old CLI against new server is fine.

## Security

- Key identity comes only from the key row; no header, body or env var can override a field the key sets.
- Plaintext keys printed once on create; never in logs, rows, errors or `jk keys list`.
- Scoped keys cannot create keys. Revoke and update check `row.userId`.
- Profile file holds only identity strings, same 0600 file. Header values still pass `clean()`.

## Risks

- `authenticate()` signature change touches every route; one main call site (`makeHandler`) plus ping/schema, covered by tests.
- Most traffic stays "Unknown" until people scope keys; the nudges above are the fix.
- `jk agent login` labels look trustworthy but are self-reported; UI says "self-reported".

## Files

Server: `convex/schema.ts`, `convex/agent/auth.ts`, `keys.ts`, `activityLog.ts`, `dispatch.ts`, `fns.ts`,
`activity.ts`, `routes.ts`, tests (`activityLog.test.ts`, new `keys.test.ts`).
CLI: `cli/src/agent.ts`, `config.ts`, `index.ts`, `output.ts`, `cli/test/*`, README.
UI: `jkChatWindow-AgentActivityMode.tsx`, `jk-agent-activity/jkActivityParts.tsx`, `jkActivitySections.tsx`,
`jkChatWindow-SettingsMode.tsx`.

## UI (FigCraft frames D30-D36, M28-M30)

**Agent Activity** (D30/M28 page, D31 details, M29 filters)

- Every row is an agent. Agent column: name, then a quiet sub-label: `via key "<name>"` (scoped),
  `self-reported` (header/profile) or `unknown agent`.
- By agent includes an "Unknown" card: "Scope a key to name this agent".
- Details panel adds Key name (or "Legacy key, no identity"), Identity source, Client (`jk/0.6.0`), plus a
  "Scope this key" hint and button.
- Filters as today: Agent, Model, Status.
- States: empty (D29 copy), filter with no matches, all rows unknown (banner suggesting scoped keys).

**Settings -> CLI keys** (D32-D36, M30)

- Create form: Name, then collapsed "Tie this key to an agent (optional)": Agent name, Model, Provider, Agent id.
- Created state: key shown once plus the identity it carries.
- Key row: identity chip (`Claude Code · claude-opus-5-5 · anthropic`) or "No identity (agent reports its own)"
  with "Add identity"; Edit identity / Revoke.
- Edit identity sheet: same fields; past activity is not changed.

## Decisions for Itwela

- May a header add model detail on a scoped key (prefix rule above), or does the key's model always win outright?
- Allow `jk keys create` from the CLI (unscoped keys only), or keep key minting web-only?
- Build `jk agent login/logout` now or after scoped keys ship?
