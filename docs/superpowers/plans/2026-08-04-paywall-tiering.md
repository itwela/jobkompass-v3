# Paywall Tiering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce plan tiers across every surface — templates by tier, CLI behind Pro, Chrome extension behind Plus — and fix the chat download plus two pricing page defects.

**Architecture:** One pure module (`convex/plans.ts`) resolves a subscription record to a numeric rank 0-3. Every gate is a rank comparison against that single function. Templates carry a `minRank`; the CLI gate lives in the agent API's one `authenticate()` chokepoint; the extension gate lives in its HTTP route. No gate lives in UI code — UI only reflects state the server already enforces.

**Tech Stack:** Next.js 16, Convex, TypeScript, vitest, Tailwind v4 (CSS-variable theming).

## Global Constraints

- Tier ranks: `free`=0, `starter`=1, `plus`/`plus-annual`=2, `pro`/`pro-annual`=3.
- Active statuses granting a tier: `active`, `trialing`, `past_due`. Also an **empty** status paired with a non-free plan, matching existing behavior in `convex/usage.ts:203`.
- Template minimum ranks: Jake 0, Joseph 1, Mar 3.
- CLI requires rank >= 3. Chrome extension requires rank >= 2.
- `convex/plans.ts` MUST NOT import from `convex/_generated/*` or `convex/server`. It is imported by Convex functions, Next.js routes, and vitest alike, and must stay a plain TypeScript module.
- Job-limit behavior in `convex/usage.ts` MUST NOT change. Its never-demote rule is extracted verbatim as `hasProPlanEver`.
- Run `npx tsc --noEmit` and `npm test` as the gate. Do NOT run or attempt to fix lint — `next lint` was removed in Next 16 and the eslint config crashes on this repo.
- Commit after every task.

---

### Task 1: Plan rank module

**Files:**
- Create: `convex/plans.ts`
- Test: `convex/plans.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type PlanRank = 0 | 1 | 2 | 3`; `interface PlanSubscriptionLike { planId?: string | null; status?: string | null }`; `planRank(sub: PlanSubscriptionLike | null | undefined): PlanRank`; `meetsTier(sub, minRank: PlanRank): boolean`; `hasProPlanEver(sub): boolean`; `rankLabel(rank: PlanRank): string`; `RANK_FREE`/`RANK_STARTER`/`RANK_PLUS`/`RANK_PRO` constants.

- [ ] **Step 1: Write the failing test**

Create `convex/plans.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  hasProPlanEver,
  meetsTier,
  planRank,
  rankLabel,
  RANK_FREE,
  RANK_PLUS,
  RANK_PRO,
  RANK_STARTER,
} from "./plans";

describe("planRank", () => {
  it("treats a missing subscription as free", () => {
    expect(planRank(null)).toBe(RANK_FREE);
    expect(planRank(undefined)).toBe(RANK_FREE);
    expect(planRank({})).toBe(RANK_FREE);
  });

  it("ranks each active plan", () => {
    expect(planRank({ planId: "starter", status: "active" })).toBe(RANK_STARTER);
    expect(planRank({ planId: "plus", status: "active" })).toBe(RANK_PLUS);
    expect(planRank({ planId: "plus-annual", status: "active" })).toBe(RANK_PLUS);
    expect(planRank({ planId: "pro", status: "active" })).toBe(RANK_PRO);
    expect(planRank({ planId: "pro-annual", status: "active" })).toBe(RANK_PRO);
  });

  it("grants the tier while trialing or past_due", () => {
    expect(planRank({ planId: "pro", status: "trialing" })).toBe(RANK_PRO);
    expect(planRank({ planId: "pro", status: "past_due" })).toBe(RANK_PRO);
  });

  it("demotes a cancelled or expired subscription to free", () => {
    expect(planRank({ planId: "pro", status: "canceled" })).toBe(RANK_FREE);
    expect(planRank({ planId: "plus", status: "incomplete_expired" })).toBe(RANK_FREE);
  });

  it("honors a paid plan carrying an empty status, matching legacy records", () => {
    expect(planRank({ planId: "pro", status: "" })).toBe(RANK_PRO);
    expect(planRank({ planId: "free", status: "" })).toBe(RANK_FREE);
  });

  it("is case insensitive and ignores unknown plans", () => {
    expect(planRank({ planId: "PRO", status: "ACTIVE" })).toBe(RANK_PRO);
    expect(planRank({ planId: "enterprise", status: "active" })).toBe(RANK_FREE);
  });
});

describe("meetsTier", () => {
  it("passes at or above the required rank", () => {
    expect(meetsTier({ planId: "pro", status: "active" }, RANK_PLUS)).toBe(true);
    expect(meetsTier({ planId: "plus", status: "active" }, RANK_PLUS)).toBe(true);
  });

  it("fails below the required rank", () => {
    expect(meetsTier({ planId: "starter", status: "active" }, RANK_PLUS)).toBe(false);
    expect(meetsTier(null, RANK_STARTER)).toBe(false);
  });
});

describe("hasProPlanEver", () => {
  it("stays true for a cancelled pro plan so job limits never demote", () => {
    expect(hasProPlanEver({ planId: "pro", status: "canceled" })).toBe(true);
    expect(hasProPlanEver({ planId: "pro-annual", status: "canceled" })).toBe(true);
  });

  it("is false for every non-pro plan", () => {
    expect(hasProPlanEver({ planId: "plus", status: "active" })).toBe(false);
    expect(hasProPlanEver(null)).toBe(false);
  });
});

describe("rankLabel", () => {
  it("names each rank", () => {
    expect(rankLabel(RANK_FREE)).toBe("Free");
    expect(rankLabel(RANK_STARTER)).toBe("Starter");
    expect(rankLabel(RANK_PLUS)).toBe("Plus");
    expect(rankLabel(RANK_PRO)).toBe("Pro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/plans.test.ts`
Expected: FAIL — cannot resolve `./plans`.

- [ ] **Step 3: Write the implementation**

Create `convex/plans.ts`:

```ts
/**
 * Plan tiers as comparable ranks. Every paywall in the app is a rank comparison
 * against this module.
 *
 * Deliberately free of Convex imports: this is loaded by Convex functions, by
 * Next.js route handlers, and by vitest, so it must stay plain TypeScript.
 */

export type PlanRank = 0 | 1 | 2 | 3;

export const RANK_FREE = 0 as const;
export const RANK_STARTER = 1 as const;
export const RANK_PLUS = 2 as const;
export const RANK_PRO = 3 as const;

/** The shape read off a `subscriptions` row. Loose on purpose so callers can pass raw docs. */
export interface PlanSubscriptionLike {
  planId?: string | null;
  status?: string | null;
}

const PLAN_RANKS: Record<string, PlanRank> = {
  free: RANK_FREE,
  starter: RANK_STARTER,
  plus: RANK_PLUS,
  "plus-annual": RANK_PLUS,
  pro: RANK_PRO,
  "pro-annual": RANK_PRO,
};

/**
 * `past_due` counts as active: a failed card retry should not kill someone's
 * access for the days Stripe spends retrying.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

const RANK_LABELS: Record<PlanRank, string> = {
  [RANK_FREE]: "Free",
  [RANK_STARTER]: "Starter",
  [RANK_PLUS]: "Plus",
  [RANK_PRO]: "Pro",
};

export function planRank(sub: PlanSubscriptionLike | null | undefined): PlanRank {
  const planId = (sub?.planId ?? "free").toLowerCase();
  const status = (sub?.status ?? "").toLowerCase();
  const rank = PLAN_RANKS[planId] ?? RANK_FREE;
  if (rank === RANK_FREE) return RANK_FREE;
  // An empty status on a paid plan is honored: older subscription rows were
  // written without one. Mirrors convex/usage.ts:203.
  if (status === "") return rank;
  return ACTIVE_STATUSES.has(status) ? rank : RANK_FREE;
}

export function meetsTier(
  sub: PlanSubscriptionLike | null | undefined,
  minRank: PlanRank
): boolean {
  return planRank(sub) >= minRank;
}

/**
 * The pre-existing "Pro never demotes" rule, extracted verbatim from
 * convex/usage.ts:186 so job limits keep behaving exactly as they do today.
 *
 * This intentionally ignores `status` and therefore disagrees with `planRank`.
 * That divergence is the point: job limits forgive a lapsed Pro, paywalls do
 * not. Do not "reconcile" these two functions.
 */
export function hasProPlanEver(sub: PlanSubscriptionLike | null | undefined): boolean {
  const planId = (sub?.planId ?? "free").toLowerCase();
  return planId === "pro" || planId === "pro-annual";
}

export function rankLabel(rank: PlanRank): string {
  return RANK_LABELS[rank];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run convex/plans.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add convex/plans.ts convex/plans.test.ts
git commit -m "Add plan rank module as the single source of tier truth"
```

---

### Task 2: Template tiering and one validator

**Files:**
- Modify: `lib/templates.ts`
- Modify: `lib/resume/generators.ts:10-43`
- Test: `lib/templates.test.ts`

**Interfaces:**
- Consumes: `PlanRank`, `RANK_*` from Task 1.
- Produces: `Template.minRank?: PlanRank`; `resumeTemplateMinRank(id: string): PlanRank`; `canUseResumeTemplate(id: string, rank: PlanRank): boolean`; `getResumeTemplatesForRank(rank: PlanRank): Template[]`. `RESUME_TEMPLATE_IDS` and `resolveResumeTemplateId` move here from `generators.ts`.

**Why the move:** `isValidResumeTemplateId` is currently defined twice with different backing data — `lib/templates.ts:89` reads `RESUME_TEMPLATES`, `lib/resume/generators.ts:41` reads `RESUME_TEMPLATE_IDS`. Different routes import different copies, so gating one leaves the other open. The template registry is the right home for both, and moving the ids there (rather than the reverse) keeps imports one-directional: `generators.ts` imports `templates.ts`, never the other way.

- [ ] **Step 1: Write the failing test**

Create `lib/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RANK_FREE, RANK_PLUS, RANK_PRO, RANK_STARTER } from "../convex/plans";
import {
  canUseResumeTemplate,
  getResumeTemplatesForRank,
  isValidResumeTemplateId,
  resumeTemplateMinRank,
} from "./templates";

describe("resumeTemplateMinRank", () => {
  it("places each template on its tier", () => {
    expect(resumeTemplateMinRank("jake")).toBe(RANK_FREE);
    expect(resumeTemplateMinRank("joseph")).toBe(RANK_STARTER);
    expect(resumeTemplateMinRank("mar")).toBe(RANK_PRO);
  });

  it("treats an unknown template as Pro rather than free", () => {
    expect(resumeTemplateMinRank("nonexistent")).toBe(RANK_PRO);
  });
});

describe("canUseResumeTemplate", () => {
  it("gives every rank Jake", () => {
    expect(canUseResumeTemplate("jake", RANK_FREE)).toBe(true);
    expect(canUseResumeTemplate("jake", RANK_PRO)).toBe(true);
  });

  it("locks Joseph to Starter and above", () => {
    expect(canUseResumeTemplate("joseph", RANK_FREE)).toBe(false);
    expect(canUseResumeTemplate("joseph", RANK_STARTER)).toBe(true);
    expect(canUseResumeTemplate("joseph", RANK_PLUS)).toBe(true);
  });

  it("locks Mar to Pro alone", () => {
    expect(canUseResumeTemplate("mar", RANK_STARTER)).toBe(false);
    expect(canUseResumeTemplate("mar", RANK_PLUS)).toBe(false);
    expect(canUseResumeTemplate("mar", RANK_PRO)).toBe(true);
  });
});

describe("getResumeTemplatesForRank", () => {
  it("returns only Jake for a free user", () => {
    expect(getResumeTemplatesForRank(RANK_FREE).map((t) => t.id)).toEqual(["jake"]);
  });

  it("returns Jake and Joseph for Starter and Plus", () => {
    expect(getResumeTemplatesForRank(RANK_STARTER).map((t) => t.id)).toEqual(["jake", "joseph"]);
    expect(getResumeTemplatesForRank(RANK_PLUS).map((t) => t.id)).toEqual(["jake", "joseph"]);
  });

  it("returns all three for Pro", () => {
    expect(getResumeTemplatesForRank(RANK_PRO).map((t) => t.id)).toEqual(["jake", "joseph", "mar"]);
  });
});

describe("isValidResumeTemplateId", () => {
  it("accepts the shipped templates and rejects anything else", () => {
    expect(isValidResumeTemplateId("jake")).toBe(true);
    expect(isValidResumeTemplateId("mar")).toBe(true);
    expect(isValidResumeTemplateId("vertex")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/templates.test.ts`
Expected: FAIL — `canUseResumeTemplate` is not exported.

- [ ] **Step 3: Add tiering to the registry**

In `lib/templates.ts`, add the import at the top of the file:

```ts
import { RANK_FREE, RANK_PRO, RANK_STARTER, type PlanRank } from '../convex/plans';
```

Add `minRank` to the `Template` interface, directly below `freeResumeEligible`:

```ts
  /**
   * Lowest plan rank that may generate with this template. Absent means free.
   * Distinct from `freeResumeEligible`, which governs the logged-out lead-magnet
   * generator and is unrelated to subscriber tiering.
   */
  minRank?: PlanRank;
```

Set it on each of the three entries in `RESUME_TEMPLATES`:
- `jake`: `minRank: RANK_FREE,`
- `joseph`: `minRank: RANK_STARTER,`
- `mar`: `minRank: RANK_PRO,`

- [ ] **Step 4: Move the id list and add the gate helpers**

Still in `lib/templates.ts`, replace the existing `isValidResumeTemplateId` (line 89) with this block:

```ts
export const RESUME_TEMPLATE_IDS = ['jake', 'joseph', 'mar'] as const;

/**
 * Template ids that were renamed. Resumes saved before a rename still carry the
 * old id, so keep resolving them instead of silently falling back to jake.
 *
 * NOTE: `mar` used to alias to `joseph`. That alias was removed when Mar was
 * reintroduced as its own template, so pre-rename resumes saved as `mar` now
 * render in the new Mar template.
 */
const LEGACY_TEMPLATE_IDS: Record<string, string> = {};

export function resolveResumeTemplateId(id: string): string {
  return LEGACY_TEMPLATE_IDS[id] ?? id;
}

export function isValidResumeTemplateId(id: string): boolean {
  return RESUME_TEMPLATES.some((t) => t.id === resolveResumeTemplateId(id));
}

/** Unknown ids return Pro, so a typo fails closed rather than granting access. */
export function resumeTemplateMinRank(id: string): PlanRank {
  const template = getResumeTemplateById(resolveResumeTemplateId(id));
  if (!template) return RANK_PRO;
  return template.minRank ?? RANK_FREE;
}

export function canUseResumeTemplate(id: string, rank: PlanRank): boolean {
  return rank >= resumeTemplateMinRank(id);
}

export function getResumeTemplatesForRank(rank: PlanRank): Template[] {
  return RESUME_TEMPLATES.filter((t) => rank >= (t.minRank ?? RANK_FREE));
}
```

- [ ] **Step 5: Point generators.ts at the registry**

In `lib/resume/generators.ts`, delete the local `RESUME_TEMPLATE_IDS`, `LEGACY_TEMPLATE_IDS`, `resolveResumeTemplateId`, and `isValidResumeTemplateId` (lines 10-43, keeping `generateResumeLatex`). Replace the deleted declarations with a re-export so existing importers keep working:

```ts
import { resolveResumeTemplateId } from '../templates';

export {
  RESUME_TEMPLATE_IDS,
  isValidResumeTemplateId,
  resolveResumeTemplateId,
} from '../templates';
```

`generateResumeLatex` keeps its existing body and continues to call `resolveResumeTemplateId(templateId)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/templates.test.ts lib/resume/`
Expected: PASS. `marLatex.test.ts` and `templatePreference.test.ts` stay green.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/templates.ts lib/templates.test.ts lib/resume/generators.ts
git commit -m "Tier resume templates and collapse the duplicate id validator"
```

---

### Task 3: Close the unauthenticated export route

**Files:**
- Modify: `app/api/resume/export/[templateId]/route.ts:13-24`
- Modify: `convex/agent/fns.ts:284` and `convex/agent/fns.ts:402` (add header to both `fetch` calls)
- Modify: `app/ai/tools/file.ts` (add header to its export `fetch` calls)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the env var contract `RESUME_EXPORT_SECRET`, sent as header `x-jk-export-secret`.

**Why this task exists:** `/api/resume/export/[templateId]` takes a template id and raw resume content and returns a compiled PDF. It has **no authentication of any kind**. Template gating cannot live here, because the route never learns who the caller is — but that also means anyone on the internet can POST content and receive a Mar PDF, bypassing every gate the other tasks add. The route must become server-to-server only, so gating can live at the authenticated callers.

- [ ] **Step 1: Reject unsigned callers**

In `app/api/resume/export/[templateId]/route.ts`, insert immediately after `const { templateId } = await params;`:

```ts
    // Server-to-server only. This route renders any template for any content, so
    // it must not be reachable from a browser or an untrusted client; tier gating
    // happens at the authenticated callers that know who the user is.
    const expectedSecret = process.env.RESUME_EXPORT_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Export not configured', message: 'RESUME_EXPORT_SECRET is not set' },
        { status: 503 }
      );
    }
    if (req.headers.get('x-jk-export-secret') !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
```

- [ ] **Step 2: Send the header from Convex**

In `convex/agent/fns.ts`, both export calls (line 284 in `resumesGenerate`, line 402 in `resumesUpdateContent`) currently read:

```ts
      headers: { "Content-Type": "application/json" },
```

Change both to:

```ts
      headers: {
        "Content-Type": "application/json",
        "x-jk-export-secret": process.env.RESUME_EXPORT_SECRET ?? "",
      },
```

- [ ] **Step 3: Send the header from the chat tool**

In `app/ai/tools/file.ts`, apply the same header addition to every `fetch` that targets `/api/resume/export/`. Search for `api/resume/export` to find them.

- [ ] **Step 4: Set the secret in both environments**

```bash
# Generate one value and use it in BOTH places — they must match.
openssl rand -hex 32
```

Set it on Convex (used by `convex/agent/fns.ts`):

```bash
npx convex env set RESUME_EXPORT_SECRET <value>
```

Set it on Vercel for production and preview (used by the route and the chat tool). Confirm with the user before running, since it touches deployed config:

```bash
npx --yes vercel@latest env add RESUME_EXPORT_SECRET production
npx --yes vercel@latest env add RESUME_EXPORT_SECRET preview
```

- [ ] **Step 5: Verify the route rejects and accepts correctly**

With `npm run dev` running:

```bash
# Expect 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:3000/api/resume/export/mar \
  -H 'Content-Type: application/json' -d '{"content":{}}'
```

Expected: `403`.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/api/resume/export/ convex/agent/fns.ts app/ai/tools/file.ts
git commit -m "Require a shared secret on the resume export route"
```

---

### Task 4: Gate the CLI behind Pro

**Files:**
- Modify: `convex/agent/auth.ts`
- Modify: `convex/agent/fns.ts` (add one internal query)
- Modify: `convex/agent/dispatch.ts:86-99, 116-128, 130-144`

**Interfaces:**
- Consumes: `planRank`, `RANK_PRO`, `meetsTier` from Task 1.
- Produces: `authenticate(ctx, request, opts?: { requireRank?: PlanRank }): Promise<string>`; `internal.agent.fns.agentPlanRank({ userId })` returning `PlanRank`.

- [ ] **Step 1: Add the rank lookup query**

In `convex/agent/fns.ts`, add near `resumesCanGenerate` (around line 171):

```ts
export const agentPlanRank = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return planRank(subscription);
  },
});
```

Add to the imports at the top of `convex/agent/fns.ts`:

```ts
import { planRank } from "../plans";
```

- [ ] **Step 2: Add the gate to authenticate()**

In `convex/agent/auth.ts`, add the import:

```ts
import { RANK_PRO, rankLabel, type PlanRank } from "../plans";
```

Replace the final two lines of `authenticate` (`await ctx.runMutation(...)` and `return match.userId;`) with:

```ts
  await ctx.runMutation(internal.agent.keys.markUsed, { id: match.keyId });

  if (opts?.requireRank) {
    const rank = await ctx.runQuery(internal.agent.fns.agentPlanRank, {
      userId: match.userId,
    });
    if (rank < opts.requireRank) {
      throw new AgentError(
        402,
        "subscription_required",
        `The JobKompass CLI requires the ${rankLabel(opts.requireRank)} plan.`,
        "Upgrade at https://www.myjobkompass.com/pricing. Run 'jk auth status' to confirm which account this key belongs to."
      );
    }
  }

  return match.userId;
```

And change the signature to:

```ts
export async function authenticate(
  ctx: GenericActionCtx<DataModel>,
  request: Request,
  opts?: { requireRank?: PlanRank }
): Promise<string> {
```

- [ ] **Step 3: Require Pro on every route except ping and schema**

In `convex/agent/dispatch.ts`, add the import:

```ts
import { RANK_PRO } from "../plans";
```

In `makeHandler` (line 89), change:

```ts
      const userId = await authenticate(ctx, request);
```

to:

```ts
      const userId = await authenticate(ctx, request, { requireRank: RANK_PRO });
```

Leave the `/agent/ping` (line 121) and `/agent/schema` (line 135) calls exactly as they are. A lapsed user must still be able to confirm their key resolves and read the error, otherwise a billing problem is indistinguishable from a broken credential.

- [ ] **Step 4: Verify against the live deployment**

Deploy to the dev slot, then check with a real key:

```bash
npx convex dev --once
jk auth status          # expect: authenticated true (ping is exempt)
jk resumes list         # expect: works, since this account is on Pro
```

To prove the gate fires, temporarily test with a non-Pro account's key if one exists. Do **not** modify the Pro account's subscription row to test this.

**No CLI-side change is required.** `cli/src/client.ts:61-67` already reads
`error.code`, `error.message`, and `error.hint` off any non-`ok` response and
rethrows them as a `CliError`, which `cli/src/index.ts:48` prints as
`error (subscription_required): ...` followed by a `hint:` line. The 402 built in
Step 2 therefore renders as a clean sentence with the upgrade URL already. Verify
this in Step 4 rather than editing the CLI.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add convex/agent/auth.ts convex/agent/fns.ts convex/agent/dispatch.ts
git commit -m "Require a Pro plan for every agent API route except ping and schema"
```

---

### Task 5: Gate the Chrome extension behind Plus

**Files:**
- Modify: `convex/http.ts:54-62`

**Interfaces:**
- Consumes: `internal.agent.fns.agentPlanRank` from Task 4, `RANK_PLUS` from Task 1.
- Produces: nothing consumed later.

**Why:** `/extension/saveJob` is already deployed and authenticates any key that exists in `extensionApiKeys`, with no plan check. This is a live hole, not preparation for a future launch.

- [ ] **Step 1: Add the rank check**

In `convex/http.ts`, add the import:

```ts
import { RANK_PLUS } from "./plans";
```

Directly after the existing `if (!keyRecord) { ... }` block (which ends around line 62), insert:

```ts
      const rank = await ctx.runQuery(internal.agent.fns.agentPlanRank, {
        userId: keyRecord.userId,
      });
      if (rank < RANK_PLUS) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "The Chrome extension requires the Plus plan or higher.",
            upgradeUrl: "https://www.myjobkompass.com/pricing",
          }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
npx convex dev --once
git add convex/http.ts
git commit -m "Require a Plus plan for the Chrome extension endpoint"
```

---

### Task 6: Gate templates at the authenticated callers

**Files:**
- Modify: `convex/agent/fns.ts:282` (`resumesGenerate`) and `convex/agent/fns.ts:400` (`resumesUpdateContent`)
- Modify: `app/ai/tools/file.ts`

**Interfaces:**
- Consumes: `canUseResumeTemplate`, `resumeTemplateMinRank` from Task 2; `agentPlanRank` from Task 4; `rankLabel` from Task 1.
- Produces: the chat tool's result gains `templateDowngraded?: { requested: string; used: string; requiredPlan: string }`.

- [ ] **Step 1: Reject over-tier templates in the agent API**

In `convex/agent/fns.ts`, add to the imports:

```ts
import { canUseResumeTemplate, resumeTemplateMinRank } from "../../lib/templates";
import { rankLabel } from "../plans";
```

In `resumesGenerate`, the line `const template = args.template || "jake";` (line 282) becomes:

```ts
    const template = args.template || "jake";
    const rank = await ctx.runQuery(internal.agent.fns.agentPlanRank, { userId });
    if (!canUseResumeTemplate(template, rank)) {
      throw new Error(
        `tier_required: The '${template}' template requires the ${rankLabel(
          resumeTemplateMinRank(template)
        )} plan. Upgrade at https://www.myjobkompass.com/pricing`
      );
    }
```

Apply the identical check in `resumesUpdateContent` after its `const template = args.template || existing.template || "jake";` (line 400).

Note: every CLI caller is already Pro after Task 4, so this is currently unreachable from `jk`. It is kept because the agent API is not CLI-exclusive by design, and because a future tier change would otherwise silently open a hole.

- [ ] **Step 2: Expose the caller's rank to authenticated app code**

The chat tools hold an authenticated `ConvexHttpClient` and already call
`api.usage.canGenerateDocument` (`app/ai/tools/file.ts:147`). Add a sibling query
so the same client can read a rank. In `convex/usage.ts`, add:

```ts
import { planRank } from "./plans";

export const currentPlanRank = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const user = await ctx.db.get(userId);
    if (!user) return 0;
    const convexUserId = (user as any).convex_user_id || userId;
    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .first();
    if (!subscription && convexUserId !== userId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    }
    return planRank(subscription);
  },
});
```

This adds a query; it does not alter any existing handler, so job-limit behavior
is untouched.

- [ ] **Step 3: Downgrade rather than refuse in chat**

In `app/ai/tools/file.ts`, resolve the rank before the template is used to build
the export URL:

```ts
  const userRank = await convexClient.query(api.usage.currentPlanRank, {});
```

Then fall back:

```ts
  // The model picks the template here, not the user, so a hard refusal would be a
  // dead end. Fall back to Jake and report it so the assistant can explain.
  let templateDowngraded:
    | { requested: string; used: string; requiredPlan: string }
    | undefined;
  if (!canUseResumeTemplate(template, userRank)) {
    templateDowngraded = {
      requested: template,
      used: 'jake',
      requiredPlan: rankLabel(resumeTemplateMinRank(template)),
    };
    template = 'jake';
  }
```

Include `templateDowngraded` in the tool's returned object so the model can surface it.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/agent/fns.ts convex/usage.ts app/ai/tools/file.ts
git commit -m "Enforce template tiers at the authenticated callers"
```

---

### Task 7: Fix the chat download

**Files:**
- Modify: `app/ai/tools/file.ts:305-320`
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-ChatMode.tsx:640-750`

**Interfaces:**
- Consumes: `downloadFirstVersionResume` from `providers/jkDocumentsProvider.tsx`.
- Produces: the resume tool result shape `{ success, message, storageId, resumeId, fileName, documentType }` — `pdfBase64` is removed.

**Why both halves matter:** the data URI breaks the download, and the base64 in the tool result injects roughly 55,000 characters (~14k tokens) into the model's message history on every generation, which is also why the render code carries five fallback branches hunting for it.

- [ ] **Step 1: Reproduce the bug first**

Generate a resume through the chat in a browser, click Download PDF, and record what happens (no file, or a viewer tab). This confirms the diagnosis before it is changed. Note the browser and OS.

- [ ] **Step 2: Return the storage id instead of the bytes**

In `app/ai/tools/file.ts`, the resume tool's success return (line ~305) currently includes `pdfBase64: pdfBase64,`. Replace that field with the saved storage and resume ids captured during the existing auto-save block, so the return reads:

```ts
      return {
        success: true,
        message: 'Resume generated and saved successfully',
        storageId,
        resumeId,
        fileName: `resume-${input.personalInfo.firstName}-${input.personalInfo.lastName}--${formattedTime}.pdf`,
        documentType: 'resume',
        ...(templateDowngraded ? { templateDowngraded } : {}),
      };
```

Use the variable names already bound by the auto-save block for the storage id and the inserted resume id; if that block does not currently keep them in scope, hoist them into `let storageId` / `let resumeId` declared above the `try`.

- [ ] **Step 3: Download via the blob path in chat**

In `jkChatWindow-ChatMode.tsx`, add the provider hook alongside the component's other hooks:

```ts
const { downloadFirstVersionResume } = useJobKompassDocuments();
```

Replace the five-branch `pdfBase64` extraction (lines 648-693) with a direct read of the new shape, and replace the anchor at line 739 with:

```tsx
<button
    onClick={() => downloadFirstVersionResume(result.storageId, result.fileName)}
    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
>
    Download PDF
</button>
```

Update the `.filter(result => result.hasPdf)` predicate to filter on `result.storageId` instead.

- [ ] **Step 4: Verify the fix in a browser**

Generate a resume in chat and click Download PDF on both desktop and mobile Safari. Expected: the file saves in both, with no new tab and no viewer.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/ai/tools/file.ts app/jk-components/jk-chatwindow-components/jkChatWindow-ChatMode.tsx
git commit -m "Download chat resumes from storage instead of a data URL"
```

---

### Task 8: Template switcher on the generated-resume card

**Files:**
- Modify: `app/jk-components/jk-chatwindow-components/jkChatWindow-ChatMode.tsx` (the card rendered in Task 7)
- Modify: `providers/jkSubscriptionProvider.tsx` (expose the rank)

**Interfaces:**
- Consumes: `getResumeTemplatesForRank`, `canUseResumeTemplate`, `resumeTemplateMinRank` from Task 2; `planRank`, `rankLabel` from Task 1; `api.agent.fns.resumesUpdateContent` equivalent app-side mutation.
- Produces: nothing consumed later.

- [ ] **Step 1: Expose the caller's rank from the subscription provider**

In `providers/jkSubscriptionProvider.tsx`, derive and return `rank` from the existing subscription object:

```ts
import { planRank } from '@/convex/plans';
// ...
const rank = planRank(subscription);
```

Add `rank` to the provider's context value and its TypeScript interface.

- [ ] **Step 2: Render the switcher row**

Below the Download PDF button inside the generated-file card, render all three templates. Entitlement is evaluated per template, so a Plus user sees Jake and Joseph unlocked with Mar locked, in the same row:

```tsx
<div className="mt-3 pt-3 border-t border-border">
    <div className="text-xs text-muted-foreground mb-2">Want this in a different template?</div>
    <div className="flex flex-wrap gap-2">
        {RESUME_TEMPLATES.map((t) => {
            const unlocked = canUseResumeTemplate(t.id, rank);
            return (
                <button
                    key={t.id}
                    onClick={() =>
                        unlocked
                            ? switchTemplate(result.resumeId, t.id)
                            : router.push('/pricing')
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        unlocked
                            ? 'border-border hover:bg-muted'
                            : 'border-border text-muted-foreground'
                    }`}
                >
                    {t.name.replace('JobKompass ', '')}
                    {!unlocked && ` · ${rankLabel(resumeTemplateMinRank(t.id))}`}
                </button>
            );
        })}
    </div>
</div>
```

- [ ] **Step 3: Regenerate in place**

`switchTemplate` reuses the path the resume editor already uses to replace a PDF
without creating a new record (`jkChatWindow-DynamicJSONEditor.tsx:20-21`):

```ts
const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
const replaceResumeFile = useMutation(api.documents.replaceResumeFile);

async function switchTemplate(resumeId: string, templateId: string) {
    // Content is unchanged — only the template differs, so this re-renders the
    // saved content and swaps the stored file on the same record.
    const res = await fetch(`/api/resume/switch-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, templateId }),
    });
    if (!res.ok) throw new Error(`Template switch failed: ${res.status}`);
    const { storageId } = await res.json();
    await replaceResumeFile({ resumeId, fileId: storageId, template: templateId });
}
```

Create `app/api/resume/switch-template/route.ts` as the authenticated wrapper: it
reads the saved resume content, checks `canUseResumeTemplate(templateId, rank)`
against the caller's rank and returns 402 if it fails, calls the export route
with the shared secret from Task 3, uploads the resulting PDF via
`generateUploadUrl`, and returns the new `storageId`.

Same record id, same name, same label, same favorite flag, PDF replaced. No new
resume row is created and no document-generation credit is consumed, because the
content is unchanged and `canGenerateDocument` is never called.

- [ ] **Step 4: Verify**

As a Pro account, switch a generated resume between all three templates and confirm via `jk resumes list` that the resume count does not increase and the id is unchanged.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/jk-components/jk-chatwindow-components/jkChatWindow-ChatMode.tsx providers/jkSubscriptionProvider.tsx
git commit -m "Add an in-place template switcher to the generated resume card"
```

---

### Task 9: Pricing page defects and copy

**Files:**
- Modify: `app/globals.css:161`
- Modify: `app/jk-components/jkPricing.tsx:346`
- Modify: `app/jk-components/jkPricing.tsx:38-101` (plan feature lists)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: White text on blue in dark mode**

In `app/globals.css`, the dark theme block sets `--primary-foreground: #0b0c0f;` on line 161 while `--primary` stays `#2196f3` in both themes, so every `bg-primary text-primary-foreground` surface renders near-black on blue. Change line 161 to:

```css
  --primary-foreground: #ffffff;
```

This is an app-wide token and intentionally corrects every blue surface in dark mode, including the Most Popular badge at `jkPricing.tsx:290`. Since `--primary` is identical in both themes, white is correct in both.

- [ ] **Step 2: Un-dim the mobile CTA**

`jkPricing.tsx:346` sits at `opacity-60` and only recovers through `group-hover/card:opacity-100`. Touch devices have no hover, so the button is permanently dimmed on mobile and reads as disabled. Replace that `className` with:

```tsx
                      className="w-full cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
```

The logged-in button on line 366 already renders at full opacity and needs no change.

- [ ] **Step 3: Correct the plan copy**

Two claims become false with this release. In `jkPricing.tsx`, replace the `features` array of the `starter` plan (line 42) with:

```ts
    features: [
      'Full app access for 7 days',
      '10 AI-generated documents',
      'Unlimited edits',
      'Track up to 100 jobs',
      'Unlimited links & resources',
      'Full search functionality',
      'Jake and Joseph resume templates',
    ],
```

Replace the `plus` plan's `features` array (line 60) with:

```ts
    features: [
      '60 AI-generated documents per month',
      'Unlimited edits on generated documents',
      'Track up to 100 jobs',
      'Unlimited links & resources',
      'Full search functionality',
      'Jake and Joseph resume templates',
      'Chrome extension access',
    ],
```

Replace the `pro` plan's `features` array (line 85) with:

```ts
    features: [
      'Everything in Plus',
      '180 AI-generated documents per month (vs 60)',
      'Track unlimited jobs (vs 100)',
      'Mar template — exclusive to Pro',
      'Command line & AI agent access (JobKompass CLI)',
      'Priority support',
    ],
```

- [ ] **Step 4: Verify visually**

Load `/pricing` in dark mode on desktop and in a mobile viewport. Confirm the Most Popular badge and all CTAs render white text on blue, and that no button looks dimmed on touch.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/globals.css app/jk-components/jkPricing.tsx
git commit -m "Fix dark-mode blue contrast, mobile CTA opacity, and plan copy"
```

---

### Task 10: Full verification and deploy

**Files:** none modified.

- [ ] **Step 1: Full test and typecheck**

```bash
npx tsc --noEmit && npm test
```

Expected: PASS. Do not run lint.

- [ ] **Step 2: Deploy both halves**

Template gating has no effect on CLI callers until the Next.js app is in production, independently of the Convex push. Both are required, or the gate looks live in the app while `jk` walks past it.

```bash
npx convex dev --once
npx --yes vercel@latest --prod --yes
```

- [ ] **Step 3: Verify the live gates**

```bash
jk auth status     # ping is exempt: still answers
jk resumes list    # Pro account: works
```

Confirm in a browser that a resume generated through chat downloads, and that the pricing page renders correctly in dark mode on a phone.
