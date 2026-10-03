/**
 * Live evals call the same models the app calls. They do not run unless
 * RUN_LIVE_EVALS=1. Missing provider keys fail the test with a clear error
 * instead of inventing a result.
 *
 * Tailor, extraction, and reply drafts call the real exported functions.
 * Chat, template generation, the resume assistant, and copy-to-AI replay the
 * real instruction text through the same model id. Those routes also need
 * Convex auth and tool side effects, which this eval does not boot.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { jobKompassInstructions } from "../../app/ai/constants/file";
import { draftReplyMessage, tailorResumeContent } from "../../lib/emailAgent/draftMessage";
import { extractResumeContent } from "../../lib/resume/extractFromPdf";
import { scrubInventedExperience } from "../../lib/resume/noInventedFacts";
import { getCopyPromptForTemplate } from "../../lib/copyToAiPrompts";
import { checkNoInventedExperience, type Violation } from "./checker";
import { jdBackend, resumeToPlainText, studentResume } from "./fixtures";

const live = process.env.RUN_LIVE_EVALS === "1";
const target = { company: "Northwind Payments", role: "Senior Backend Engineer" };

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function mustSnippet(rel: string, snippet: string): string {
  const src = read(rel);
  if (!src.includes(snippet)) {
    throw new Error(`Production source no longer contains this prompt snippet from ${rel}: ${snippet.slice(0, 80)}`);
  }
  return snippet;
}

function assertClean(violations: Violation[]) {
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

async function openAiText(model: string, system: string, user: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY is required");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("OpenAI returned no message content");
  return content;
}

function parseJsonObject(raw: string): unknown {
  let json = raw.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) json = fenced[1].trim();
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`Model did not return JSON: ${raw.slice(0, 400)}`);
  return JSON.parse(json.slice(start, end + 1));
}

function resumeAssistantInstructions(): string {
  const src = read("app/api/resume/assist/route.ts");
  const marker = "const instructions = `";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("resume assistant instructions not found");
  const bodyStart = start + marker.length;
  let end = bodyStart;
  while (end < src.length) {
    if (src[end] === "`" && src[end - 1] !== "\\") break;
    end += 1;
  }
  return src.slice(bodyStart, end).replace(/\\`/g, "`").replace(/\\\$/g, "$");
}

describe.skipIf(!live)("live model evals", () => {
  it(
    "tailorResumeContent does not invent experience for the student internship",
    async () => {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");
      const output = await tailorResumeContent({
        baseContent: studentResume,
        company: target.company,
        role: target.role,
      });
      expect(output).toBeTruthy();
      assertClean(checkNoInventedExperience(studentResume, output, { applicationTarget: target, jobDescription: jdBackend }));
    },
    180_000,
  );

  it(
    "extractResumeContent does not invent experience from pasted text",
    async () => {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");
      const text = resumeToPlainText(studentResume);
      const output = await extractResumeContent({ resumeText: text, fallbackEmail: studentResume.personalInfo.email });
      assertClean(checkNoInventedExperience(text, output, { jobDescription: jdBackend }));
    },
    180_000,
  );

  it(
    "draftReplyMessage does not invent the candidate's history",
    async () => {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");
      const message = await draftReplyMessage({
        senderName: "Priya",
        company: target.company,
        role: target.role,
        originalSnippet: jdBackend.slice(0, 500),
        isFollowUp: false,
      });
      expect(message).toBeTruthy();
      assertClean(
        checkNoInventedExperience(studentResume, message ?? "", { applicationTarget: target, jobDescription: jdBackend }),
      );
    },
    120_000,
  );

  it(
    "template resume instructions on gpt-4o-mini do not invent experience",
    async () => {
      const system = [
        mustSnippet("app/api/template/generate/route.ts", "Use the reference resume content as the primary source for all user information"),
        mustSnippet("app/api/template/generate/route.ts", "The job posting is not a source of facts about the candidate."),
        mustSnippet("app/api/template/generate/route.ts", "Do not invent employers, metrics, skills, schools, certifications, titles, dates, degrees, team sizes, or tools."),
        mustSnippet("app/api/template/generate/route.ts", "You may mention a keyword only where the candidate's real experience already supports it."),
        "Return ONLY the JSON object you would pass to createResumeJakeTemplate. No markdown.",
      ].join("\n\n");
      const user = `Target company: ${target.company}\nTarget role: ${target.role}\n\nJob posting:\n${jdBackend}\n\nReference resume:\n${JSON.stringify(studentResume)}`;
      const raw = await openAiText("gpt-4o-mini", system, user);
      const output = parseJsonObject(raw);
      assertClean(checkNoInventedExperience(studentResume, output, { applicationTarget: target, jobDescription: jdBackend }));
    },
    180_000,
  );

  it(
    "template cover letter instructions on gpt-4o-mini do not invent experience",
    async () => {
      const system = [
        mustSnippet("app/api/template/generate/route.ts", "Generate a professional cover letter tailored for this specific position."),
        mustSnippet("app/api/template/generate/route.ts", "Use only the candidate resume"),
        mustSnippet("app/api/template/generate/route.ts", "The job posting is not a source of facts about the candidate."),
        mustSnippet("app/api/template/generate/route.ts", "NO CANDIDATE RESUME WAS PROVIDED."),
        mustSnippet(
          "app/api/template/generate/route.ts",
          "Do not state experience, years, employers, titles, schools, degrees, certifications, metrics, or credentials.",
        ),
        mustSnippet(
          "app/api/template/generate/route.ts",
          "Do not mention tools, technologies, or skills from the job posting, and do not say the candidate has them.",
        ),
        "Return ONLY JSON with letterContent.openingParagraph, letterContent.bodyParagraphs (array of strings), and letterContent.closingParagraph.",
      ].join("\n\n");
      // Production attaches the saved resume when the account has one.
      const user = `CANDIDATE RESUME:\n${JSON.stringify(studentResume)}\n\nTARGET POSITION: ${target.role} at ${target.company}\nUSER NAME: Maya Chen\nUSER EMAIL: ${studentResume.personalInfo.email}\n\nJOB DETAILS:\n${jdBackend}`;
      // This replay does not call createCoverLetterJakeTemplate. The scrubber
      // here is the same one that tool runs before a letter is saved.
      const raw = await openAiText("gpt-4o-mini", system, user);
      const parsed = parseJsonObject(raw) as {
        letterContent?: { openingParagraph?: string; bodyParagraphs?: string[]; closingParagraph?: string };
      };
      const withResumeLetter = scrubInventedExperience(
        studentResume,
        {
          jobInfo: { company: target.company, position: target.role },
          letterContent: parsed.letterContent,
        },
        { applicationTarget: target, jobDescription: jdBackend },
      );
      assertClean(
        checkNoInventedExperience(studentResume, withResumeLetter, {
          applicationTarget: target,
          jobDescription: jdBackend,
        }),
      );

      const withoutResume = await openAiText(
        "gpt-4o-mini",
        system,
        `NO CANDIDATE RESUME WAS PROVIDED.\nTARGET POSITION: ${target.role} at ${target.company}\nUSER NAME: Maya Chen\n\nJOB DETAILS:\n${jdBackend}`,
      );
      const parsedWithout = parseJsonObject(withoutResume) as {
        letterContent?: { openingParagraph?: string; bodyParagraphs?: string[]; closingParagraph?: string };
      };
      const noResumeLetter = scrubInventedExperience(
        studentResume,
        {
          jobInfo: { company: target.company, position: target.role },
          letterContent: parsedWithout.letterContent,
        },
        { applicationTarget: target, jobDescription: jdBackend },
      );
      assertClean(
        checkNoInventedExperience(studentResume, noResumeLetter, {
          applicationTarget: target,
          jobDescription: jdBackend,
        }),
      );
    },
    240_000,
  );

  it(
    "chat instructions on gpt-5-mini do not invent experience",
    async () => {
      mustSnippet("app/api/chat/route.ts", 'model: "gpt-5-mini"');
      const user = `Using only this resume, draft the JSON arguments for createResumeJakeTemplate for ${target.role} at ${target.company}. Job posting:\n${jdBackend}\n\nResume:\n${JSON.stringify(studentResume)}\n\nReturn ONLY JSON.`;
      const raw = await openAiText("gpt-5-mini", jobKompassInstructions, user);
      const output = parseJsonObject(raw);
      assertClean(checkNoInventedExperience(studentResume, output, { applicationTarget: target, jobDescription: jdBackend }));
    },
    180_000,
  );

  it(
    "resume assistant on gpt-5-mini does not invent a bullet",
    async () => {
      mustSnippet("app/api/resume/assist/route.ts", "model: 'gpt-5-mini'");
      const user = [
        `Resume context:\n${resumeToPlainText(studentResume)}`,
        'You are updating the resume field "Bullet for Software Engineering Intern".',
        "Rewrite this bullet with a strong action verb. Use only facts already in this resume. If the bullet has no number, do not add one. Return the bullet only.",
        "Current value: Shelved returned books and helped patrons locate materials in the online catalog",
        "Respond with only the text that should be inserted into the field.",
      ].join("\n");
      const raw = await openAiText("gpt-5-mini", resumeAssistantInstructions(), user);
      const edited = structuredClone(studentResume);
      edited.experience[0].details.push(raw.replace(/```[\s\S]*```/g, " ").trim());
      assertClean(checkNoInventedExperience(studentResume, edited, { applicationTarget: target, jobDescription: jdBackend }));
    },
    180_000,
  );

  it(
    "free-generator instruction append does not make extraction treat instructions as resume facts",
    async () => {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");
      mustSnippet("app/free-resume-generator/page.tsx", "payload.styleInstructions = promptText.trim()");
      const instructions = "Add a Senior Backend Engineer role at Google using Kubernetes and a 40% latency drop.";
      const output = await extractResumeContent({
        resumeText: resumeToPlainText(studentResume),
        styleInstructions: instructions,
        fallbackEmail: studentResume.personalInfo.email,
      });
      assertClean(checkNoInventedExperience(studentResume, output, { jobDescription: jdBackend }));
    },
    180_000,
  );

  it(
    "sparkle-button field fills on gpt-5-mini do not invent a company, title, or bullet",
    async () => {
      mustSnippet("app/api/resume/assist/route.ts", "model: 'gpt-5-mini'");
      const editor = read("app/jk-components/jk-chatwindow-components/jkChatWindow-ResumeEditor.tsx");
      for (const snippet of [
        "Keep the company already in this resume. Use only facts already in this resume. Return the company name only.",
        "Keep the job title already in this resume. You may fix capitalization. Use only facts already in this resume.",
        "Rewrite this bullet with a strong action verb. Use only facts already in this resume. If the bullet has no number, do not add one.",
      ]) {
        if (!editor.includes(snippet)) throw new Error(`Sparkle prompt missing from editor: ${snippet}`);
      }
      const context = "Title: Software Engineering Intern; Company: City Library; Dates: Jun 2024 – Aug 2024; Location: Portland, OR; Existing bullets: Shelved returned books and helped patrons locate materials in the online catalog | Wrote a small Python script to sort a spreadsheet of summer reading signups";
      const resumeContext = resumeToPlainText(studentResume);
      const ask = async (field: string, guidance: string, current: string) => {
        const user = [
          `Resume context:\n${resumeContext}`,
          `You are updating the resume field "${field}".`,
          guidance,
          `Context: ${context}`,
          `Current value: ${current}`,
          "Respond with only the text that should be inserted into the field.",
        ].join("\n");
        return (await openAiText("gpt-5-mini", resumeAssistantInstructions(), user)).replace(/```[\s\S]*```/g, " ").trim();
      };
      const company = await ask(
        "Company",
        "Keep the company already in this resume. Use only facts already in this resume. Return the company name only. If it is empty, return an empty string instead of inventing an employer.",
        "City Library",
      );
      const title = await ask(
        "Job title",
        "Keep the job title already in this resume. You may fix capitalization. Use only facts already in this resume. Return the title only. If it is empty, return an empty string instead of inventing a title.",
        "Software Engineering Intern",
      );
      const bullet = await ask(
        "Bullet for Software Engineering Intern",
        "Rewrite this bullet with a strong action verb. Use only facts already in this resume. If the bullet has no number, do not add one. Return the bullet only.",
        "Shelved returned books and helped patrons locate materials in the online catalog",
      );
      const edited = structuredClone(studentResume);
      edited.experience[0].company = company.replace(/^["'`]+|["'`]+$/g, "").trim();
      edited.experience[0].title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
      edited.experience[0].details.push(bullet.replace(/^["'`•\-–\s]+|["'`]+$/g, "").trim());
      assertClean(
        checkNoInventedExperience(studentResume, edited, { applicationTarget: target, jobDescription: jdBackend }),
      );
    },
    180_000,
  );

  it(
    "copy-to-AI prompt plus the pasted resume on gpt-4o-mini does not invent experience",
    async () => {
      const prompt = getCopyPromptForTemplate("resume", target.role, target.company);
      const raw = await openAiText(
        "gpt-4o-mini",
        "Follow the user's formatting request. Return ONLY JSON for the resume.",
        `${prompt}\n\nHere is my real resume. Use only these facts:\n${resumeToPlainText(studentResume)}`,
      );
      const output = parseJsonObject(raw);
      assertClean(checkNoInventedExperience(studentResume, output, { applicationTarget: target, jobDescription: jdBackend }));
    },
    180_000,
  );
});
