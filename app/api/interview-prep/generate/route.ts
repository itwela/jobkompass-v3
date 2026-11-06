import { NextRequest, NextResponse } from "next/server";
import { enforceAiRateLimit } from "@/lib/rateLimit/guard";
import { TEMPLATE_GENERATION_MODEL_ID } from "@/lib/aiModels";

const OPENAI_KEY =
  process.env.NODE_ENV === "production"
    ? process.env.OPENAI_API_KEY
    : process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are an elite technical interview coach. Given a job posting (company, role, description, notes) and optionally the candidate's resume content, generate a comprehensive, battle-tested Interview Prep deck in strict JSON format.

CRITICAL RULES:
- NEVER invent experience, metrics, companies, or skills the candidate does not actually have in their resume.
- If a job requirement is NOT in the candidate's resume, mark its strength as "pivot" in requirementMatches and write an honest, confident pivot strategy in flashcards/traps (e.g., how to bridge from their actual experience without claiming tools they haven't used).
- Lead every story and answer with concrete outcomes and real systems from their resume.
- Return valid JSON matching this exact structure:
{
  "elevatorPitch": "A 60-90 second spoken opener tailored to this role and the candidate's real background.",
  "roleSummary": "2-3 sentence summary of what this role really cares about and the core problem they are hiring to solve.",
  "flashcards": [
    {
      "id": "fc-1",
      "category": "role" | "technical" | "experience" | "objection" | "behavioral" | "logistics",
      "front": "Question or prompt the interviewer will ask or concept to know",
      "back": "Crisp, spoken-style answer grounded in real metrics and systems",
      "hint": "Short 3-6 word trigger cue",
      "confidence": "new",
      "starred": true
    }
  ],
  "stories": [
    {
      "id": "st-1",
      "title": "Project / Company — Specific Angle",
      "tag": "Primary competency (e.g. RAG & Enterprise Connectors)",
      "hook": "1-sentence spoken hook that grabs attention",
      "situation": "The bottleneck or problem that existed before",
      "action": "What the candidate architected and shipped",
      "outcome": "Measurable impact and adoption",
      "takeaway": "Why this proves they can succeed in the target role"
    }
  ],
  "requirementMatches": [
    {
      "id": "rm-1",
      "requirement": "Specific requirement from the job description",
      "priority": "must-have" | "nice-to-have",
      "yourProof": "Exact proof from candidate's background or honest pivot strategy",
      "strength": "strong" | "moderate" | "pivot"
    }
  ],
  "questionsToAsk": [
    {
      "id": "qa-1",
      "question": "Sharp, high-signal question to ask the interviewer",
      "whyItMatters": "Why this question signals seniority or protects the candidate",
      "category": "Role & Scope" | "Architecture" | "Compensation & Logistics" | "Success Metrics",
      "asked": false
    }
  ],
  "trapsAndGuardrails": [
    {
      "id": "tr-1",
      "trap": "Specific mistake or trap to avoid in this interview",
      "howToHandle": "Exact guardrail and what to say instead"
    }
  ],
  "checklist": [
    {
      "id": "cl-1",
      "label": "Concrete pre-call action item",
      "done": false
    }
  ]
}

Generate 8-12 flashcards across categories, 3-4 STAR stories, 6-8 requirement matches, 5-6 questions to ask, 3-4 traps/guardrails, and 5-6 checklist items.`;

export async function POST(req: NextRequest) {
  const limited = await enforceAiRateLimit(req, "ai");
  if (limited) return limited;

  if (!OPENAI_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { company, role, description, notes, resumeContent } = body;

    if (!company || !role) {
      return NextResponse.json(
        { error: "Company and role are required" },
        { status: 400 }
      );
    }

    const userPrompt = `Generate an Interview Prep deck for:
Company: ${company}
Role: ${role}

Job Description:
${description || "Not provided"}

Candidate Notes / Interview Context:
${notes || "Not provided"}

Candidate Resume Content (ONLY use facts from here; do not invent):
${resumeContent ? JSON.stringify(resumeContent, null, 2) : "Not provided"}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: TEMPLATE_GENERATION_MODEL_ID,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 3500,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        data.error?.message || data.message || "Failed to generate interview prep";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw);
    return NextResponse.json({ success: true, prep: parsed });
  } catch (error) {
    console.error("Interview prep generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate prep" },
      { status: 500 }
    );
  }
}
