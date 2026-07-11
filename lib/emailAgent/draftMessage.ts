// lib/emailAgent/draftMessage.ts

export function parseDraftMessageResponse(raw: string): string | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    trimmed = trimmed.slice(1, -1);
  }
  // gemma sometimes keeps generating past the reply, hallucinating additional
  // "Sender: ... / Company: ..." example exchanges in the same shape as our user
  // prompt — cut everything from the first such continuation.
  const leak = trimmed.search(/\n\s*Sender:/);
  if (leak !== -1) {
    trimmed = trimmed.slice(0, leak).trim();
  }
  // Drop placeholder signature lines; the user signs when they review the draft.
  // Covers "[Your name]"-style brackets with ANY content, plus a bare trailing
  // signature line (a few words, no sentence punctuation — e.g. "Mairtri").
  trimmed = trimmed.replace(/\n\s*\[[^\]\n]{1,40}\]\s*$/g, "").trim();
  const lines = trimmed.split("\n");
  const last = lines[lines.length - 1].trim();
  if (lines.length > 1 && last.split(/\s+/).length <= 3 && !/[.!?,]$/.test(last)) {
    trimmed = lines.slice(0, -1).join("\n").trim();
  }
  return trimmed || null;
}

export async function draftReplyMessage(input: {
  senderName: string;
  company: string;
  role: string;
  originalSnippet: string;
  isFollowUp: boolean;
}): Promise<string | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OpenRouter API key not configured on server");

  const systemPrompt = input.isFollowUp
    ? `You write brief, polite one-paragraph follow-up emails from a job seeker to a recruiter/founder who has not responded in about a week. No subject line, no greeting formatting beyond "Hi <name>,", no sign-off beyond a first name. Reference the role and company naturally. Respond with ONLY the message text.`
    : `You write brief, warm, one-paragraph reply emails from a job seeker responding to a recruiter/founder's outreach about a specific role. Express genuine interest, mention the attached resume, and ask a natural next-step question. No subject line, "Hi <name>," greeting, no signature or name at the end — stop after the final sentence. Never use bracketed fill-ins like "[mention a skill]" — write complete, ready-to-send sentences and simply omit specifics you don't know (the resume is attached, so don't enumerate skills). Write exactly ONE reply and nothing else. Respond with ONLY the message text.`;

  const userPrompt = `Sender: ${input.senderName}\nCompany: ${input.company}\nRole: ${input.role}\nOriginal message snippet: ${input.originalSnippet}`;

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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 400,
      // Hard stop if the model starts hallucinating another example exchange
      // shaped like our user prompt (see parseDraftMessageResponse).
      stop: ["\nSender:"],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseDraftMessageResponse(content);
}

// The model's JSON is imperfect often enough to matter (stray prose before the
// object, trailing commentary), so parse defensively: strip fences, then fall back
// to the outermost {...} slice.
export function parseTailoredResumeResponse(raw: string): any | null {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(jsonStr);
  } catch {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(jsonStr.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function tailorResumeContent(input: {
  baseContent: any;
  company: string;
  role: string;
}): Promise<any | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OpenRouter API key not configured on server");

  const systemPrompt = `You tailor resume content for a specific job application. You will receive a JSON object representing a resume (personalInfo, experience, education, projects, skills, certifications, additionalInfo). Return a JSON object with the EXACT SAME shape and keys, but:
- Rewrite personalInfo.summary (if present) to emphasize fit for the target role/company.
- Within each experience item's "details" array, reorder bullets to put the most relevant ones first. Do not invent new bullets or change factual content (companies, titles, dates).
- Within skills, reorder to put the most relevant skills first. Do not add skills that aren't already present.
Respond with ONLY the JSON object, no explanation or markdown.`;

  const userPrompt = `Target company: ${input.company}\nTarget role: ${input.role}\n\nBase resume JSON:\n${JSON.stringify(input.baseContent)}`;

  // Model output is nondeterministic; a malformed-JSON response on the first try
  // often parses fine on a retry.
  for (let attempt = 1; attempt <= 2; attempt++) {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      console.error(`tailorResumeContent: OpenRouter returned ${response.status} (attempt ${attempt}/2)`);
      continue;
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = parseTailoredResumeResponse(content);
    if (parsed) return parsed;
    console.error(
      `tailorResumeContent: model output was not valid JSON (finish_reason=${data.choices?.[0]?.finish_reason}, length=${content.length}, attempt ${attempt}/2, head=${JSON.stringify(content.slice(0, 120))})`
    );
  }
  return null;
}
