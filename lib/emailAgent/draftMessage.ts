// lib/emailAgent/draftMessage.ts

export function parseDraftMessageResponse(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
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
    : `You write brief, warm, one-paragraph reply emails from a job seeker responding to a recruiter/founder's outreach about a specific role. Express genuine interest, mention the attached resume, and ask a natural next-step question. No subject line, "Hi <name>," greeting, sign off with just a first name placeholder "[Your name]". Respond with ONLY the message text.`;

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
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseDraftMessageResponse(content);
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
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
