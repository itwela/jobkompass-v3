
export type ClassificationResult =
  | { type: "personal_outreach"; company: string; role: string; senderName: string }
  | { type: "digest"; listings: Array<{ company: string; role: string; link: string }> }
  | { type: "neither" };

const CLASSIFICATION_PROMPT = `You are a job-opportunity email classifier. Given an email's subject, sender, and body, classify it and extract structured data.

Return ONLY valid JSON matching exactly one of these shapes:

1. A direct, personal message from a specific person (recruiter, founder, hiring manager) about a specific role at a specific company:
{"type": "personal_outreach", "company": string, "role": string, "senderName": string}

2. An automated JOB alert/digest bundling multiple job listings (e.g. LinkedIn, Indeed, Handshake job alerts):
{"type": "digest", "listings": [{"company": string, "role": string, "link": string}, ...]}

3. Anything else (newsletters, receipts, unrelated mail, application status updates):
{"type": "neither"}

Rules:
- Only use "personal_outreach" for a message that reads like it was written by/for one specific person about one specific opportunity.
- "digest" is ONLY for emails whose purpose is to list open job positions. A listing must be an actual job posting: a specific role title a person could apply for at a specific employer.
- NEVER extract products, services, courses, events, artworks, crypto/NFT/token announcements, investment offers, store categories, or feature announcements as listings. A marketing or content newsletter is "neither" even if it lists many items.
- If an email is promotional and contains no real job postings, return {"type": "neither"} — do not force listings out of it.
- Respond with ONLY the JSON object, no explanation or markdown.`;

/**
 * Rescue a digest response that the model got cut off partway through.
 *
 * A job alert bundling 30+ listings can overrun max_tokens, so the response ends
 * mid-listing and won't parse. Every job in that email would otherwise be thrown
 * away. Trim back to the last listing that closed cleanly and shut the array, which
 * keeps the listings that did arrive intact.
 *
 * Only complete objects survive: the partial one at the cut is discarded, and if
 * nothing completed there is nothing to recover.
 */
function salvageTruncatedDigest(jsonStr: string): any | null {
  if (!jsonStr.includes('"listings"')) return null;

  const lastCompleteListing = jsonStr.lastIndexOf("}");
  if (lastCompleteListing === -1) return null;

  try {
    return JSON.parse(jsonStr.slice(0, lastCompleteListing + 1) + "]}");
  } catch {
    return null;
  }
}

export function parseClassificationResponse(raw: string): ClassificationResult | null {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = salvageTruncatedDigest(jsonStr);
    if (!parsed) return null;
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

  // The poll cron classifies bursts of up to ~100 backlogged emails, which trips
  // OpenRouter rate limits — retry transient failures (429/5xx) with backoff instead
  // of surfacing them as classification errors.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://myjobkompass.com",
        "X-Title": "JobKompass Email Agent",
      },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it",
        messages: [
          { role: "system", content: CLASSIFICATION_PROMPT },
          {
            role: "user",
            content: `Subject: ${input.subject}\nFrom: ${input.from}\n\n${input.bodyText.substring(0, 8000)}`,
          },
        ],
        temperature: 0.1,
        // A digest bundling 30+ jobs needs well over 1000 tokens of JSON. At 1000 the
        // response was cut off mid-listing, failed to parse, and the entire email was
        // dropped — every job in it lost. Give long digests room to finish;
        // salvageTruncatedDigest only has to cover the extreme outliers now.
        max_tokens: 4000,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || "";
      const result = parseClassificationResponse(content);

      if (!result) {
        // Never fail silently here: without the raw output a dropped email is
        // impossible to diagnose after the fact.
        console.error(
          `Unparseable classification response (finish_reason: ${choice?.finish_reason ?? "unknown"}, ` +
            `length: ${content.length}). Raw: ${content.slice(0, 500)}`
        );
      }
      return result;
    }

    const retryable = response.status === 429 || response.status >= 500;
    console.error(
      `OpenRouter classification failed (status ${response.status}, attempt ${attempt}/${maxAttempts})${retryable && attempt < maxAttempts ? ", retrying" : ""}`
    );
    if (!retryable) return null;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  return null;
}
