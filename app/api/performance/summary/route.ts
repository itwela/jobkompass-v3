/**
 * "What JobKompass sees" (D11 / M09, Pro only).
 *
 * Reads the caller's own jobs on the server, turns them into plain counts
 * (lib/performance/stats.ts → insightFacts) and asks the model for three
 * observations, each a short headline plus the evidence behind it. The model may
 * only use the numbers it is given. Returns:
 *   200 { items: { headline, evidence }[] }            three items
 *   200 { items: [], reason: "not-enough-data" }       fewer than 5 applications
 *   401 not signed in · 402 not on Pro
 */

import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { RANK_PRO } from "@/convex/plans";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { FREE_RESUME_MODEL_IDS } from "@/lib/aiModels";
import { convexForCaller } from "@/lib/onboarding/server";
import { insightFacts } from "@/lib/performance/stats";

export const maxDuration = 60;

const MIN_APPLICATIONS = 5;

const SYSTEM_PROMPT = `You look at one person's job search numbers and point out the three things most worth knowing.

Return JSON only: {"items":[{"headline":"...","evidence":"..."}]} with exactly 3 items.
- headline: one short sentence, under 60 characters, stating the finding. Example: "67 of 236 went quiet."
- evidence: one sentence, under 110 characters, with the numbers that back it up, or what to do about it.
- Use ONLY numbers present in the data. Never estimate, never round into new claims, never invent a cause.
- If a comparison group is too small (under 3 applications), don't build an item on it.
- Plain words. No exclamation marks, no "great job", no "consider", no em dashes.`;

export interface InsightItem {
  headline: string;
  evidence: string;
}

function parseItems(raw: string): InsightItem[] {
  const text = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) return [];
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .filter((i: any) => typeof i?.headline === "string" && typeof i?.evidence === "string")
      .map((i: any) => ({ headline: i.headline.trim().slice(0, 120), evidence: i.evidence.trim().slice(0, 220) }))
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

  const limited = await enforceAiRateLimit(req, "ai");
  if (limited) return limited;

  const jobs = (await convex.query(api.jobs.list, {})) ?? [];
  const facts = insightFacts(jobs);
  if (facts.all.applications < MIN_APPLICATIONS) {
    return NextResponse.json({ items: [], reason: "not-enough-data", applications: facts.all.applications });
  }

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
        max_tokens: 600,
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
      const items = parseItems(raw);
      if (items.length > 0) return NextResponse.json({ items, modelUsed: model });
    } catch (err) {
      console.error("performance summary", model, err);
    }
  }
  return NextResponse.json({ error: "Couldn't read your numbers right now. Try again in a minute." }, { status: 502 });
}
