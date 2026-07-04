# JobKompass Agent API + `jk` CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API-key-authenticated `/agent/*` HTTP API in JobKompass's Convex backend + a globally installed `jk` CLI: full CRUD for jobs, resumes, cover letters, email templates, resources; read access to threads.

**Architecture:** Same proven architecture as `fuellog` (reference implementation: `/Users/itwelaibomu/Desktop/Code/fuellog/convex/agent/` and `/Users/itwelaibomu/Desktop/Code/fuellog/cli/`): hashed API keys → Bearer auth → declarative route table → dispatch. One difference: JobKompass functions resolve identity via Convex Auth (`getAuthUserId`), so the agent layer gets its own **internal wrapper functions** in `convex/agent/fns.ts` that take an explicit `userId` and enforce ownership themselves (mirroring each public function's logic minus the auth resolution).

**Tech Stack:** Convex HTTP actions, Node 20+, commander, tsup, vitest.

**Spec:** vault `docs/superpowers/specs/2026-07-04-agent-clis-design.md` (subsystem 2 of 3). Approved deviations discovered during recon:
1. **New `agentApiKeys` table (hashed) instead of migrating `extensionApiKeys`** — the extension UI displays the stored plaintext key by design (`extensionApiKeys.get` returns it); hashing would break the shipped extension + settings UI. The extension flow stays untouched; flag its plaintext keys + the public unauthenticated `jobs.addForAgent` / `resources.addForAgent` mutations as follow-up security items in the final report.
2. **No `resume-generate` / `coverletter-generate` CLI actions in v1** — generation is interactive agent-thread based (`dopeAgents.ts` exports no callable action with clean args). Deferred; the HTTP layer makes adding one trivial later.
3. **`contacts` excluded** — recon showed it's the site contact-form inbox (name/email/subject/message/ip), not user-owned career contacts.
4. ids as query/body params, not path segments (same as fuel; Convex router has no path params).

## Global Constraints

- Repo: `/Users/itwelaibomu/Desktop/Code/jobkompass-v3` (freshly cloned; branch `agent-cli`; commit per task).
- **No dev deployment exists.** Live prod = `prod:proficient-mammoth-632` (site URL `https://proficient-mammoth-632.convex.site`). All changes must be purely additive (new files, new routes, new table); typecheck locally (`npx tsc --noEmit -p convex`) before every deploy; deploy via `CONVEX_DEPLOYMENT=prod:proficient-mammoth-632 npx convex deploy -y`.
- Do not modify existing convex files except `schema.ts` (add table) and `http.ts` (append routes).
- Table `agentApiKeys` (camelCase, matches JK naming). Key format `jk_sk_` + 48 hex. SHA-256 hashes only.
- Envelope/exit codes/conventions identical to fuel (see fuel plan Global Constraints).
- CLI: `cli/` dir, binary `jk`, env `JK_API_KEY`/`JK_BASE_URL`/`JK_CONFIG_DIR`, config `~/.config/jk/config.json`.
- Smoke test runs against prod with a throwaway userId `agent-smoke-user` and deletes everything it creates.
- Itwela's real userId: the users-table doc id used across jobs/resumes data — verify at wiring time via `npx convex data jobs --limit 1` (recon showed `k97cdznm4pbk7aep1spyyzwg1x85w12d`); also confirm `convex_user_id` is unset/equal on his users row.

---

### Task 1: `agentApiKeys` table + key module

**Files:**
- Modify: `convex/schema.ts` (append table before closing `});`)
- Create: `convex/agent/keys.ts`

**Interfaces:** Produces `sha256Hex`, `agent/keys:generate` action `{userId,name}→{key}`, `internal.agent.keys.lookupByHash`, `markUsed`, public `list`/`revoke` — identical signatures to fuellog's `convex/agent/keys.ts`.

- [ ] Step 1: Append to `convex/schema.ts`:

```ts
  agentApiKeys: defineTable({
    userId: v.string(),
    name: v.string(),
    keyHash: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["keyHash"])
    .index("by_user", ["userId"]),
```

- [ ] Step 2: Create `convex/agent/keys.ts` by copying `/Users/itwelaibomu/Desktop/Code/fuellog/convex/agent/keys.ts` verbatim with exactly two changes: every `"api_keys"` → `"agentApiKeys"`, and the key prefix `"fuel_sk_"` → `"jk_sk_"`.
- [ ] Step 3: `npx tsc --noEmit -p convex` → no errors. Deploy: `CONVEX_DEPLOYMENT=prod:proficient-mammoth-632 npx convex deploy -y` → succeeds. Verify:
```bash
CONVEX_DEPLOYMENT=prod:proficient-mammoth-632 npx convex run agent/keys:generate '{"userId":"agent-smoke-user","name":"task1"}'
```
Expected: `{"key":"jk_sk_..."}`. Save as `$KEY`.
- [ ] Step 4: Commit `feat(agent): agentApiKeys table + hashed key management`.

---

### Task 2: auth helper + internal wrapper functions

**Files:**
- Create: `convex/agent/auth.ts`
- Create: `convex/agent/fns.ts`

**Interfaces:** `auth.ts` identical to fuel's (copy verbatim; update the two hint strings `fuel auth login`→`jk auth login`). `fns.ts` produces the internal functions the route table (Task 3) references as `internal.agent.fns.<name>`:

- [ ] Step 1: Copy fuel's `convex/agent/auth.ts`; adjust hint strings.
- [ ] Step 2: Create `convex/agent/fns.ts`. Every function takes explicit `userId`; id-taking ops load the doc and require `doc.userId === userId` (throwing `"<thing> not found"`). Mirror the corresponding public function's logic minus `getAuthUserId`. Full code:

```ts
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const jobFields = {
  company: v.string(),
  title: v.string(),
  link: v.string(),
  status: v.string(),
  compensation: v.optional(v.string()),
  keywords: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
  dateApplied: v.optional(v.string()),
  interviewed: v.optional(v.boolean()),
  easyApply: v.optional(v.string()),
  resumeUsed: v.optional(v.string()),
  coverLetterUsed: v.optional(v.string()),
  notes: v.optional(v.string()),
};

async function owned(ctx: any, id: any, userId: string, label: string) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) throw new Error(`${label} not found`);
  return doc;
}

// ---- jobs ----
export const jobsList = internalQuery({
  args: { userId: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { userId, status }) => {
    const jobs = await ctx.db.query("jobs").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const filtered = status ? jobs.filter((j) => j.status.toLowerCase() === status.toLowerCase()) : jobs;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
export const jobsGet = internalQuery({
  args: { userId: v.string(), id: v.id("jobs") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Job"),
});
export const jobsAdd = internalMutation({
  args: { userId: v.string(), ...jobFields },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("jobs", { ...args, createdAt: now, updatedAt: now });
  },
});
export const jobsUpdate = internalMutation({
  args: {
    userId: v.string(), id: v.id("jobs"),
    company: v.optional(v.string()), title: v.optional(v.string()), link: v.optional(v.string()),
    status: v.optional(v.string()), compensation: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())), skills: v.optional(v.array(v.string())),
    description: v.optional(v.string()), dateApplied: v.optional(v.string()),
    interviewed: v.optional(v.boolean()), easyApply: v.optional(v.string()),
    resumeUsed: v.optional(v.string()), coverLetterUsed: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Job");
    const patch = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});
export const jobsRemove = internalMutation({
  args: { userId: v.string(), id: v.id("jobs") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Job");
    await ctx.db.delete(id);
  },
});

// ---- resumes ----
export const resumesList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db.query("resumes").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).map(({ content, ...meta }) => meta);
  },
});
export const resumesGet = internalQuery({
  args: { userId: v.string(), id: v.id("resumes") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Resume"),
});
export const resumesDelete = internalMutation({
  args: { userId: v.string(), id: v.id("resumes") },
  handler: async (ctx, { userId, id }) => {
    const resume = await owned(ctx, id, userId, "Resume");
    if (resume.fileId) await ctx.storage.delete(resume.fileId);
    await ctx.db.delete(id);
  },
});
export const resumesDuplicate = internalMutation({
  args: { userId: v.string(), id: v.id("resumes") },
  handler: async (ctx, { userId, id }) => {
    const resume = await owned(ctx, id, userId, "Resume");
    const now = Date.now();
    return await ctx.db.insert("resumes", {
      userId, name: `${resume.name} (Copy)`, createdAt: now, updatedAt: now,
      isActive: resume.isActive ?? true, content: resume.content,
      label: resume.label, tags: resume.tags, template: resume.template,
    });
  },
});
export const resumesRename = internalMutation({
  args: { userId: v.string(), id: v.id("resumes"), name: v.string() },
  handler: async (ctx, { userId, id, name }) => {
    await owned(ctx, id, userId, "Resume");
    await ctx.db.patch(id, { name, updatedAt: Date.now() });
  },
});

// ---- cover letters ----
export const coverLettersList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db.query("coverLetters").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).map(({ content, ...meta }) => meta);
  },
});
export const coverLettersGet = internalQuery({
  args: { userId: v.string(), id: v.id("coverLetters") },
  handler: async (ctx, { userId, id }) => owned(ctx, id, userId, "Cover letter"),
});
export const coverLettersDelete = internalMutation({
  args: { userId: v.string(), id: v.id("coverLetters") },
  handler: async (ctx, { userId, id }) => {
    const letter = await owned(ctx, id, userId, "Cover letter");
    if (letter.fileId) await ctx.storage.delete(letter.fileId);
    await ctx.db.delete(id);
  },
});
export const coverLettersDuplicate = internalMutation({
  args: { userId: v.string(), id: v.id("coverLetters") },
  handler: async (ctx, { userId, id }) => {
    const letter = await owned(ctx, id, userId, "Cover letter");
    const now = Date.now();
    return await ctx.db.insert("coverLetters", {
      userId, name: `${letter.name} (Copy)`, createdAt: now, updatedAt: now,
      isActive: letter.isActive ?? true, content: letter.content,
      label: letter.label, tags: letter.tags, template: letter.template,
    });
  },
});

// ---- email templates ----
export const emailTemplatesList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db.query("emailTemplates").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
export const emailTemplatesSave = internalMutation({
  args: { userId: v.string(), name: v.string(), subject: v.string(), body: v.string() },
  handler: async (ctx, { userId, name, subject, body }) => {
    const now = Date.now();
    return await ctx.db.insert("emailTemplates", { userId, name, subject, body, createdAt: now, updatedAt: now });
  },
});
export const emailTemplatesUpdate = internalMutation({
  args: {
    userId: v.string(), id: v.id("emailTemplates"),
    name: v.optional(v.string()), subject: v.optional(v.string()), body: v.optional(v.string()),
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Email template");
    const patch = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});
export const emailTemplatesDelete = internalMutation({
  args: { userId: v.string(), id: v.id("emailTemplates") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Email template");
    await ctx.db.delete(id);
  },
});

// ---- resources ----
export const resourcesList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db.query("resources").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
export const resourcesAdd = internalMutation({
  args: {
    userId: v.string(), type: v.string(), title: v.string(), url: v.string(),
    description: v.optional(v.string()), notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())), category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("resources", { ...args, createdAt: now, updatedAt: now });
  },
});
export const resourcesUpdate = internalMutation({
  args: {
    userId: v.string(), id: v.id("resources"),
    type: v.optional(v.string()), title: v.optional(v.string()), url: v.optional(v.string()),
    description: v.optional(v.string()), notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())), category: v.optional(v.string()),
  },
  handler: async (ctx, { userId, id, ...fields }) => {
    await owned(ctx, id, userId, "Resource");
    const patch = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});
export const resourcesRemove = internalMutation({
  args: { userId: v.string(), id: v.id("resources") },
  handler: async (ctx, { userId, id }) => {
    await owned(ctx, id, userId, "Resource");
    await ctx.db.delete(id);
  },
});

// ---- threads (read-only) ----
export const threadsList = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db.query("threads").collect();
    return all.filter((t) => t.userId === userId).sort((a, b) => b.updatedAt - a.updatedAt)
      .map((t) => ({ _id: t._id, title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt }));
  },
});
export const threadsGet = internalQuery({
  args: { userId: v.string(), id: v.id("threads") },
  handler: async (ctx, { userId, id }) => {
    const thread = await owned(ctx, id, userId, "Thread");
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", id))
      .collect();
    return { thread, messages };
  },
});
```

Adjust at implementation time only if a referenced index name (`by_user` on resumes/coverLetters/emailTemplates, `by_thread` on messages) or optional field (`label`/`tags`/`template`/`isActive`/`fileId` on resumes/coverLetters; `body`/`subject` on emailTemplates) doesn't match `schema.ts` — mirror whatever the public function in `documents.ts` actually reads. Threads list scans without an index because `threads.userId` is optional/legacy; volume is tiny (personal app).

- [ ] Step 3: `npx tsc --noEmit -p convex`; deploy; commit `feat(agent): auth helper + explicit-userId wrapper functions`.

---

### Task 3: route table + dispatcher wired into existing http.ts

**Files:**
- Create: `convex/agent/routes.ts`
- Create: `convex/agent/dispatch.ts`
- Modify: `convex/http.ts` (append only)

- [ ] Step 1: Copy fuel's `convex/http.ts` dispatcher internals (`json`, `ok`, `fail`, `coerce`, `buildArgs`, `makeHandler`, ping/schema handlers) into `convex/agent/dispatch.ts`, exporting `registerAgentRoutes(http: HttpRouter)` that registers ping, schema, and every route. Two changes: `app: "fuellog"` → `app: "jobkompass"`, and since every JK route calls an **internal** function, dispatch uses `internal.agent.fns.*` references from the route table and there is no `owned`/`injectUser` handling — wrappers own both concerns; `userId` is always injected. Simplified `makeHandler` core:

```ts
const args = await buildArgs(route, request);
args.userId = userId;
const result = route.kind === "query" ? await ctx.runQuery(route.fn, args) : await ctx.runMutation(route.fn, args);
return ok(result);
```

- [ ] Step 2: Create `convex/agent/routes.ts` — same `ParamSpec`/`AgentRoute` types as fuel (minus `owned`/`injectUser`), `fn` referencing `internal.agent.fns.*`:

| method | path | fn | params |
|---|---|---|---|
| GET | /agent/jobs | jobsList | status? |
| GET | /agent/jobs/get | jobsGet | id* |
| POST | /agent/jobs | jobsAdd | company*, title*, link*, status*, compensation?, keywords?(json), skills?(json), description?, dateApplied?, interviewed?(bool), easyApply?, resumeUsed?, coverLetterUsed?, notes? |
| PATCH | /agent/jobs | jobsUpdate | id* + all job fields optional |
| DELETE | /agent/jobs | jobsRemove | id* |
| GET | /agent/resumes | resumesList | — |
| GET | /agent/resumes/get | resumesGet | id* |
| DELETE | /agent/resumes | resumesDelete | id* |
| POST | /agent/resumes/duplicate | resumesDuplicate | id* |
| PATCH | /agent/resumes | resumesRename | id*, name* |
| GET | /agent/coverletters | coverLettersList | — |
| GET | /agent/coverletters/get | coverLettersGet | id* |
| DELETE | /agent/coverletters | coverLettersDelete | id* |
| POST | /agent/coverletters/duplicate | coverLettersDuplicate | id* |
| GET | /agent/emailtemplates | emailTemplatesList | — |
| POST | /agent/emailtemplates | emailTemplatesSave | name*, subject*, body* |
| PATCH | /agent/emailtemplates | emailTemplatesUpdate | id*, name?, subject?, body? |
| DELETE | /agent/emailtemplates | emailTemplatesDelete | id* |
| GET | /agent/resources | resourcesList | — |
| POST | /agent/resources | resourcesAdd | title*, url*, type (default "resource"), description?, notes?, tags?(json), category? |
| PATCH | /agent/resources | resourcesUpdate | id*, title?, url?, type?, description?, notes?, tags?(json), category? |
| DELETE | /agent/resources | resourcesRemove | id* |
| GET | /agent/threads | threadsList | — |
| GET | /agent/threads/get | threadsGet | id* |

(`*` = required; `?` = optional; types string unless noted.)

- [ ] Step 3: In `convex/http.ts`, add `import { registerAgentRoutes } from "./agent/dispatch";` and `registerAgentRoutes(http);` before `export default http;`. Touch nothing else.
- [ ] Step 4: typecheck → deploy → curl verify (same probes as fuel Task 3: 401 no-auth, ping ok, jobs list `[]` for smoke user, add job, bad param 400, schema). Commit `feat(agent): /agent routes + dispatcher`.

---

### Task 4: `jk` CLI

**Files:** Create `cli/` — copy fuel's entire `cli/` directory, then apply:
- `package.json`: name `jk-cli`, bin `{ "jk": "./dist/index.js" }`.
- `src/config.ts`: `DEFAULT_BASE_URL = "https://proficient-mammoth-632.convex.site"`, env/config prefix `JK_` (`JK_API_KEY`, `JK_BASE_URL`, `JK_CONFIG_DIR`), config dir `~/.config/jk`.
- `src/index.ts`: program name `jk`, description "Agent-first CLI for JobKompass"; auth hint strings say `jk auth login`.
- `src/commands.ts`: replace the table with the jk surface (mirror the Task 3 route table; noun-verb):
  - `jobs list [--status]`, `jobs get --id`, `jobs add --company --title --link --status [...]`, `jobs update --id [...]`, `jobs delete --id --yes`
  - `resumes list|get|rename|duplicate|delete(--yes)`
  - `coverletters list|get|duplicate|delete(--yes)`
  - `emailtemplates list|add|update|delete(--yes)`
  - `resources list|add|update|delete(--yes)`
  - `threads list|get`
  - plus `auth login/status/logout`, `schema` (from the copied index.ts)
- `test/`: keep dates/config/output tests; change config test env vars to `JK_*` and key literals to `jk_sk_*`.

- [ ] Steps: copy → edit → `npm install` → `npx vitest run` (all pass) → `npm run build` → `npm link` → verify `jk auth login $KEY`, `jk jobs add/list/delete --yes` against prod with the smoke user key. Commit `feat(cli): jk command surface`.

---

### Task 5: smoke script + README

- [ ] `cli/smoke.sh` — same shape as fuel's: auth → jobs lifecycle (add/list/get/update/delete) → emailtemplates lifecycle → resources lifecycle → resumes+coverletters list (read-only — don't fabricate resume content) → threads list → schema length check. All records under the smoke key's userId (`agent-smoke-user`); every created record deleted; ends `SMOKE PASS`.
- [ ] `cli/README.md` — fuel's README adapted (jk names, key generation command with `CONVEX_DEPLOYMENT=prod:proficient-mammoth-632`).
- [ ] Run smoke against prod → `SMOKE PASS`. Commit `test(cli): jk smoke + README`.

---

### Task 6: real-key wiring + push + docs

- [ ] Verify Itwela's userId: `CONVEX_DEPLOYMENT=prod:proficient-mammoth-632 npx convex data jobs --limit 1` (userId field) and check his `users` row's `convex_user_id` is unset or equal.
- [ ] Mint: `... npx convex run agent/keys:generate '{"userId":"<real>","name":"itwela-cli"}'` → `jk auth login <key>` → `jk jobs list` returns his real jobs; reversible write test (add a job titled "cli test", delete it with `--yes`).
- [ ] Revoke the smoke key (`agent/keys:revoke`) or leave documented.
- [ ] Push branch → merge to main → `git push origin main`.
- [ ] Update vault Project State (JobKompass entry: jk CLI facts, deployment name, security follow-ups: plaintext extensionApiKeys + public addForAgent mutations) and memory (`project_jobkompass_cli.md`). Commit vault.
