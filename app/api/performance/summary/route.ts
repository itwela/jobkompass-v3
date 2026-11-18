/**
 * "What JobKompass sees" (D11 / M09, Pro only).
 *
 * Reads the caller's own jobs on the server, turns them into plain counts
 * (lib/performance/stats.ts → insightFacts) and asks the model for three
 * observations, each a short headline plus the evidence behind it. The model may
 * only use the numbers it is given. Returns:
 *   200 { items: { headline, evidence }[], cached }    three items
 * The items are stored with a fingerprint of the numbers they were written from. While
 * the numbers stay the same the stored items are returned and no model is called.
 *   200 { items: [], reason: "not-enough-data" }       fewer than 5 applications
 *   401 not signed in · 402 not on Pro
 */

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { RANK_PRO } from "@/convex/plans";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { FREE_RESUME_MODEL_IDS } from "@/lib/aiModels";
import { convexForCaller } from "@/lib/onboarding/server";
import { insightFacts } from "@/lib/performance/stats";
import { firstJsonObject } from "@/lib/emailAgent/draftMessage";

export const maxDuration = 60;

const MIN_APPLICATIONS = 5;

const SYSTEM_PROMPT = `You look at one person's job search numbers and point out the three things most worth knowing.

Return JSON only: {"items":[{"headline":"...","evidence":"...","count":0,"total":0}]} with exactly 3 items.
- headline: one short sentence, under 60 characters, stating the finding in words. Example: "Most applications went quiet."
- evidence: one sentence, under 110 characters, that adds something the headline does not: a second number that explains it, a comparison with another group, or the next step. Never restate the headline.
- count and total: the two whole numbers the finding is about, copied from the data, where count is the part and total is the whole it is a part of (67 ghosted of 236 applications: count 67, total 236). Leave both out if the finding is not a part of a whole.
- Use ONLY numbers present in the data. Never estimate, never round into new claims, never invent a cause.
- If a comparison group is too small (under 3 applications), don't build an item on it.
- Plain words. No exclamation marks, no "great job", no "consider", no em dashes.`;

export interface InsightItem {
  headline: string;
  evidence: string;
  /** The part and the whole the finding is about. Present only when both are numbers from the data. */
  count?: number;
  total?: number;
}

/** Every number that appears anywhere in the facts. A figure the model returns must be one of these. */
function numbersIn(value: unknown, out = new Set<number>()): Set<number> {
  if (typeof value === "number") out.add(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) numbersIn(v, out);
  return out;
}

function parseItems(raw: string, known: Set<number>): InsightItem[] {
  const text = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const json = firstJsonObject(text);
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .filter((i: any) => typeof i?.headline === "string" && typeof i?.evidence === "string")
      .map((i: any) => {
        const item: InsightItem = { headline: i.headline.trim().slice(0, 120), evidence: i.evidence.trim().slice(0, 220) };
        const ok = Number.isInteger(i.count) && Number.isInteger(i.total) && i.total > 0 && i.count >= 0 && i.count <= i.total && known.has(i.count) && known.has(i.total);
        return ok ? { ...item, count: i.count, total: i.total } : item;
      })
      .filter((i: InsightItem) => i.headline && i.evidence)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const convex = await convexForCaller();
  if (!convex) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const rank = await convex.query(api.usage.currentPlanRank, {});
  if (rank < RANK_PRO) return NextResponse.json({ error: "What JobKompass sees is part of Pro." }, { status: 402 });

  const jobs = (await convex.query(api.jobs.list, {})) ?? [];
  const facts = insightFacts(jobs);
  if (facts.all.applications < MIN_APPLICATIONS) {
    return NextResponse.json({ items: [], reason: "not-enough-data", applications: facts.all.applications });
  }

  // Same numbers (and same instructions) as last time: reuse what was written then.
  const factsKey = createHash("sha256").update(SYSTEM_PROMPT).update(JSON.stringify(facts)).digest("hex");
  const stored = await convex.query(api.performanceInsights.getMine, {}).catch(() => null);
  if (stored && stored.factsKey === factsKey && stored.items.length > 0) {
    return NextResponse.json({ items: stored.items, cached: true });
  }

  const limited = await enforceAiRateLimit(req, "ai");
  if (limited) return limited;

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });

  const call = (model: string) =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://jobkompass.com",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Data:\n${JSON.stringify(facts, null, 2)}` },
        ],
        temperature: 0.3,
        // Both models reason before answering; 600 tokens ran out mid-thought and returned nothing.
        max_tokens: 4000,
        reasoning: { effort: "low" },
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(40000),
    });

  for (const model of FREE_RESUME_MODEL_IDS.slice(0, 2)) {
    try {
      const res = await call(model);
      if (!res.ok) continue;
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const raw = typeof content === "string"
        ? content
        : Array.isArray(content) ? content.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("") : "";
      const items = parseItems(raw, numbersIn(facts));
      if (items.length > 0) {
        await convex.mutation(api.performanceInsights.saveMine, { factsKey, items }).catch((err) => console.error("performance summary save", err));
        return NextResponse.json({ items, cached: false, modelUsed: model });
      }
    } catch (err) {
      console.error("performance summary", model, err);
    }
  }
  return NextResponse.json({ error: "Couldn't read your numbers right now. Try again in a minute." }, { status: 502 });
}
