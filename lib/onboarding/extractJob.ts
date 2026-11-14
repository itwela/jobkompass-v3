import { DEFAULT_RESUME_EXTRACTION_MODEL_IDS } from "@/lib/aiModels";
import { parseTailoredResumeResponse } from "@/lib/emailAgent/draftMessage";

export interface ExtractedJob {
  company: string;
  title: string;
  location?: string;
  compensation?: string;
  keywords: string[];
  skills: string[];
  description: string;
}

const SYSTEM = `You read one job posting and return its details as JSON. Return ONLY this JSON object:
{"company": string, "title": string, "location": string|null, "compensation": string|null, "keywords": string[], "skills": string[], "description": string}
- company and title exactly as the posting states them.
- location: city or "Remote" as written; null if absent.
- compensation: the pay as written (e.g. "$150k - $180k"); null if the posting gives none. Never guess.
- keywords: the 3 most important skills or technologies for the role, each 1-2 words.
- skills: up to 10 skills named in the posting.
- description: the posting's own text (responsibilities and requirements), copied, not summarised. Leave out navigation, cookie banners and other page chrome.
If the text is not a job posting, return {"company": "", "title": ""}.`;

/** Pulls company, title, pay and keywords out of a posting's text with the extraction model. */
export async function extractJob(postingText: string, link?: string): Promise<ExtractedJob | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter not configured");
  const models = [
    process.env.OPENROUTER_RESUME_MODEL_PRIMARY?.trim() || DEFAULT_RESUME_EXTRACTION_MODEL_IDS[0],
    process.env.OPENROUTER_RESUME_MODEL_FALLBACK?.trim() || DEFAULT_RESUME_EXTRACTION_MODEL_IDS[1],
  ];
  for (const model of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://www.myjobkompass.com", "X-Title": "JobKompass Onboarding" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${link ? `Link: ${link}\n\n` : ""}Posting:\n${postingText.slice(0, 30000)}` },
        ],
        temperature: 0.1,
        max_tokens: 6000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = await res.json();
    const parsed = parseTailoredResumeResponse(String(data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, ""));
    if (!parsed || typeof parsed !== "object") continue;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : []);
    const company = str(parsed.company);
    const title = str(parsed.title);
    if (!company || !title) return null;
    return {
      company,
      title,
      location: str(parsed.location),
      compensation: str(parsed.compensation),
      keywords: arr(parsed.keywords).slice(0, 5),
      skills: arr(parsed.skills).slice(0, 10),
      description: str(parsed.description) ?? postingText.slice(0, 12000),
    };
  }
  throw new Error("Could not read the posting right now");
}
