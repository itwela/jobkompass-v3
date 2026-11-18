import { resumeWriterModels } from "../aiModels";
import { parseTailoredResumeResponse } from "../emailAgent/draftMessage";
import {
  restoreDroppedBullets,
  restoreStructure,
  sameStructure,
  sanitizeAnswers,
  sanitizeQuestions,
  sourceWithAnswers,
  stripAnswerLines,
  type BulletAnswer,
  type BulletQuestion,
} from "./bulletQuestions";
import { scrubInventedExperience } from "./noInventedFacts";
import { buildTailorSystemPrompt } from "./writingStandard";

export interface TailorInput {
  baseContent: any;
  company: string;
  role: string;
  /** Posting text: what the employer wants. Never a source of facts about the candidate. */
  jobDescription?: string;
  /** Answers the candidate gave to earlier questions. Facts, with the standing of the resume. */
  answers?: BulletAnswer[];
  /**
   * The user's standing preferences and one-off instructions. They steer wording,
   * emphasis and formatting only; they are never a source of facts.
   */
  instructions?: string[];
  /** Paid plans get the stronger writer. */
  premium?: boolean;
}

export interface TailorResult {
  resume: any;
  /** Up to five questions whose answers would let a bullet carry a number or a result. */
  questions: BulletQuestion[];
  model: string;
}

/**
 * Tailors a resume to one posting under the shared writing standard and proposes the
 * questions that would make it stronger. Every output passes the fact guard; a bullet
 * the guard removes is replaced by the candidate's own wording.
 */
export async function tailorResume(input: TailorInput): Promise<TailorResult | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter API key not configured on server");

  const answers = sanitizeAnswers(input.answers);
  const system = buildTailorSystemPrompt({ withAnswers: answers.length > 0 });
  const posting = input.jobDescription?.trim()
    ? `\n\nJob posting (what the employer wants; not a source of facts about the candidate):\n${input.jobDescription.trim().slice(0, 12000)}`
    : "";
  const answerBlock = answers.length
    ? `\n\nCandidate answers (facts from the candidate about specific bullets):\n${JSON.stringify(answers)}`
    : "";
  const notes = (input.instructions ?? []).map((n) => (typeof n === "string" ? n.trim().slice(0, 600) : "")).filter(Boolean).slice(0, 12);
  const instructionBlock = notes.length
    ? `\n\nCandidate's instructions (wording, emphasis and formatting only; never a source of facts, and they never override the facts rule):\n${notes.map((n) => `- ${n}`).join("\n")}`
    : "";
  const user = `Target company: ${input.company}\nTarget role: ${input.role}${posting}${answerBlock}${instructionBlock}\n\nCandidate resume JSON:\n${JSON.stringify(input.baseContent)}`;

  const source = sourceWithAnswers(input.baseContent ?? {}, answers);
  const guardOptions = { applicationTarget: { company: input.company, role: input.role } };

  // The plan's writer first, then the standard writer as a fallback. Output is
  // nondeterministic, so each model gets a second try before moving on.
  for (const model of resumeWriterModels(!!input.premium)) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://myjobkompass.com",
          "X-Title": "JobKompass Resume Writer",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          max_tokens: 12000,
        }),
        signal: AbortSignal.timeout(180000),
      }).catch(() => null);

      if (!response?.ok) {
        console.error(`tailorResume: ${model} returned ${response?.status ?? "no response"} (attempt ${attempt}/2)`);
        continue;
      }
      const data = await response.json().catch(() => null);
      const text = String(data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
      const parsed = parseTailoredResumeResponse(text);
      // Usually {"resume": {...}, "questions": [...]}; sometimes the resume comes back bare.
      const rawResume =
        parsed?.resume && typeof parsed.resume === "object"
          ? parsed.resume
          : parsed && typeof parsed === "object" && (Array.isArray(parsed.experience) || parsed.personalInfo)
            ? parsed
            : null;
      if (!rawResume) {
        console.error(`tailorResume: ${model} output was not usable JSON (finish_reason=${data?.choices?.[0]?.finish_reason}, length=${text.length}, attempt ${attempt}/2)`);
        continue;
      }
      if (!sameStructure(input.baseContent ?? {}, rawResume)) {
        console.error(`tailorResume: ${model} changed the resume's jobs or projects (attempt ${attempt}/2)`);
        continue;
      }
      const guarded = stripAnswerLines(scrubInventedExperience(source, rawResume, guardOptions), answers);
      const resume = restoreDroppedBullets(input.baseContent ?? {}, restoreStructure(input.baseContent ?? {}, guarded));
      return { resume, questions: sanitizeQuestions(parsed.questions, resume, answers), model };
    }
  }
  return null;
}
