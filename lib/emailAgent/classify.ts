
export type ClassificationResult =
  | { type: "personal_outreach"; company: string; role: string; senderName: string }
  | { type: "digest"; listings: Array<{ company: string; role: string; link: string }> }
  | { type: "neither" };

const CLASSIFICATION_PROMPT = `You are a job-opportunity email classifier. Given an email's subject, sender, and body, classify it and extract structured data.

Return ONLY valid JSON matching exactly one of these shapes:

1. A direct, personal message from a specific person (recruiter, founder, hiring manager) about a specific role at a specific company:
{"type": "personal_outreach", "company": string, "role": string, "senderName": string}

2. An automated digest/alert bundling multiple job listings (e.g. LinkedIn or Indeed job alerts):
{"type": "digest", "listings": [{"company": string, "role": string, "link": string}, ...]}

3. Anything else (newsletters, receipts, unrelated mail, application status updates):
{"type": "neither"}

Rules:
- Only use "personal_outreach" for a message that reads like it was written by/for one specific person about one specific opportunity.
- For "digest", extract every listing you can find with its direct link.
- Respond with ONLY the JSON object, no explanation or markdown.`;

export function parseClassificationResponse(raw: string): ClassificationResult | null {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (parsed?.type === "personal_outreach" && parsed.company && parsed.role && parsed.senderName) {
    return {
      type: "personal_outreach",
      company: String(parsed.company),
      role: String(parsed.role),
      senderName: String(parsed.senderName),
    };
  }

  if (parsed?.type === "digest" && Array.isArray(parsed.listings)) {
    return {
      type: "digest",
      listings: parsed.listings
        .filter((l: any) => l && l.company && l.role)
        .map((l: any) => ({
          company: String(l.company),
          role: String(l.role),
          link: String(l.link || ""),
        })),
    };
  }

  if (parsed?.type === "neither") {
    return { type: "neither" };
  }

  return null;
}

export async function classifyEmail(input: {
  subject: string;
  from: string;
  bodyText: string;
}): Promise<ClassificationResult | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OpenRouter API key not configured on server");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://myjobkompass.com",
      "X-Title": "JobKompass Email Agent",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        {
          role: "user",
          content: `Subject: ${input.subject}\nFrom: ${input.from}\n\n${input.bodyText.substring(0, 8000)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseClassificationResponse(content);
}
