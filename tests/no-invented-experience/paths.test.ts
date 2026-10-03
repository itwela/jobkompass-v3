import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobKompassInstructions, resumeBestPractices } from "../../app/ai/constants/file";
import { tailorResumeContent, draftReplyMessage } from "../../lib/emailAgent/draftMessage";
import { EXTRACTION_SYSTEM_PROMPT, extractResumeContent } from "../../lib/resume/extractFromPdf";
import { getCopyPromptForTemplate } from "../../lib/copyToAiPrompts";
import { checkNoInventedExperience } from "./checker";
import {
  inventedStudentResume,
  jdBackend,
  resumeToPlainText,
  rewordedStudentResume,
  sparseResume,
  studentResume,
} from "./fixtures";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

function stubModel(content: string) {
  const calls: Array<{ url: string; body: any }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content }, finish_reason: "stop" }] }),
      text: async () => content,
      clone() {
        return this;
      },
    };
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const target = { company: "Northwind Payments", role: "Senior Backend Engineer" };

describe("email agent resume tailoring (tailorResumeContent)", () => {
  it("sends the real resume to gemma and returns a harmless rewrite unchanged", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const calls = stubModel(JSON.stringify(rewordedStudentResume()));
    const output = await tailorResumeContent({
      baseContent: studentResume,
      company: target.company,
      role: target.role,
    });
    expect(calls[0].body.model).toBe("google/gemma-3-27b-it");
    expect(calls[0].body.messages[0].content).toContain("Do not invent new bullets");
    expect(calls[0].body.messages[1].content).toContain("City Library");
    expect(checkNoInventedExperience(studentResume, output, { applicationTarget: target, jobDescription: jdBackend })).toEqual([]);
  });

  it("catches a mocked invented tailor response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubModel(JSON.stringify(inventedStudentResume()));
    const output = await tailorResumeContent({
      baseContent: studentResume,
      company: target.company,
      role: target.role,
    });
    const violations = checkNoInventedExperience(studentResume, output, { applicationTarget: target, jobDescription: jdBackend });
    expect(violations.map((violation) => violation.kind)).toEqual(
      expect.arrayContaining(["employer", "metric", "skill", "school"]),
    );
    expect(violations.some((violation) => violation.value === "Northwind Payments")).toBe(true);
  });

  it("documents the tailor prompt's partial guard", () => {
    const src = read("lib/emailAgent/draftMessage.ts");
    expect(src).toContain("Do not invent new bullets or change factual content (companies, titles, dates).");
    expect(src).toContain("Do not add skills that aren't already present.");
  });

  it.fails(
    "EXPECTED FAILURE: email tailor prompt does not forbid invented metrics, schools, degrees, certifications, or using the job as a fact source",
    () => {
      const src = read("lib/emailAgent/draftMessage.ts");
      const body = src.slice(src.indexOf("const systemPrompt = `You tailor resume content"));
      expect(body).toMatch(/do not (invent|add|change)[^.]{0,160}(metric|percent|number)/i);
      expect(body).toMatch(/do not (invent|add)[^.]{0,120}(school|degree|certif)/i);
      expect(body).toMatch(/job (description|posting) is not a source of facts/i);
    },
  );
});

describe("email agent reply draft (draftReplyMessage)", () => {
  it("catches a mocked reply that invents the candidate's history", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const calls = stubModel(
      "I spent 5 years building Kubernetes platforms at Google and improved uptime to 99.9%.",
    );
    const message = await draftReplyMessage({
      senderName: "Priya",
      company: target.company,
      role: target.role,
      originalSnippet: jdBackend,
      isFollowUp: false,
    });
    expect(calls[0].body.model).toBe("google/gemma-3-27b-it");
    expect(calls[0].body.messages[1].content).not.toContain("City Library");
    const violations = checkNoInventedExperience(studentResume, message, { applicationTarget: target, jobDescription: jdBackend });
    expect(violations.map((violation) => violation.kind)).toEqual(expect.arrayContaining(["employer", "metric", "skill"]));
  });

  it("accepts a mocked reply that does not add candidate facts", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubModel(
      "Hi Priya, I am interested in the Senior Backend Engineer opening at Northwind Payments. My resume is attached. Could we find a time to talk?",
    );
    const message = await draftReplyMessage({
      senderName: "Priya",
      company: target.company,
      role: target.role,
      originalSnippet: jdBackend,
      isFollowUp: false,
    });
    expect(checkNoInventedExperience(studentResume, message, { applicationTarget: target })).toEqual([]);
  });

  it.fails(
    "EXPECTED FAILURE: reply drafts never receive the resume, so the model can invent employers, metrics, and skills",
    () => {
      const src = read("lib/emailAgent/draftMessage.ts");
      const body = src.slice(src.indexOf("export async function draftReplyMessage"));
      expect(body).toMatch(/baseContent|resume JSON|candidate resume/i);
      expect(body).toMatch(/do not invent (employers|experience|metrics)/i);
    },
  );
});

describe("resume extraction (extractResumeContent)", () => {
  it("uses the real extraction prompt and accepts a faithful parse", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const calls = stubModel(JSON.stringify(studentResume));
    const text = resumeToPlainText(studentResume);
    const output = await extractResumeContent({ resumeText: text });
    expect(calls[0].body.messages[0].content).toBe(EXTRACTION_SYSTEM_PROMPT);
    expect(calls[0].body.messages[1].content).toContain("City Library");
    expect(calls[0].body.model).toBe("openai/gpt-oss-20b");
    expect(checkNoInventedExperience(text, output)).toEqual([]);
  });

  it("catches a mocked parse that adds a job the paste does not contain", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubModel(JSON.stringify(inventedStudentResume()));
    const output = await extractResumeContent({ resumeText: resumeToPlainText(studentResume) });
    const violations = checkNoInventedExperience(studentResume, output);
    expect(violations.some((violation) => violation.kind === "employer" && violation.value === "Northwind Payments")).toBe(true);
  });

  it("callers are the free generator, document upload, and template generation", () => {
    for (const file of [
      "app/api/free-resume/generate/route.ts",
      "app/api/documents/generate-resume-pdf/route.ts",
      "app/api/template/generate/route.ts",
    ]) {
      expect(read(file)).toContain("extractResumeContent");
    }
  });

  it.fails(
    "EXPECTED FAILURE: extraction prompt tells the model to infer fields and does not forbid invented employers, skills, metrics, schools, or certifications",
    () => {
      expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/do not (invent|add|infer)[^.]{0,80}(employer|compan|skill|metric|school|certif)/i);
      expect(EXTRACTION_SYSTEM_PROMPT).not.toMatch(/infer from content/i);
    },
  );
});

describe("free resume generator instruction append", () => {
  it("appends the user's AI instructions onto the resume text with only a space", () => {
    const src = read("app/free-resume-generator/page.tsx");
    expect(src).toContain("`${resumeText.trim()} ${promptText.trim()}`");
  });

  it("shows those appended instructions can make invented facts look supported", () => {
    const instructions = "Add a Senior Backend Engineer role at Google using Kubernetes and a 40% latency drop.";
    const appended = `${resumeToPlainText(sparseResume)} ${instructions}`;
    const parsed = structuredClone(sparseResume);
    parsed.experience = [
      {
        company: "Google",
        title: "Senior Backend Engineer",
        location: "Remote",
        date: "Jan 2020 - Present",
        details: ["Reduced latency 40% with Kubernetes"],
      },
    ];
    const againstRealResume = checkNoInventedExperience(sparseResume, parsed);
    const againstAppendedText = checkNoInventedExperience(appended, parsed);
    expect(againstRealResume.length).toBeGreaterThan(0);
    expect(againstAppendedText.length).toBeLessThan(againstRealResume.length);
  });

  it.fails(
    "EXPECTED FAILURE: free resume generation does not keep AI instructions out of the text the extractor treats as the resume",
    () => {
      const src = read("app/free-resume-generator/page.tsx");
      expect(src).not.toContain("`${resumeText.trim()} ${promptText.trim()}`");
    },
  );
});

describe("template generation", () => {
  const route = () => read("app/api/template/generate/route.ts");

  it("catches an invented resume in the shape createResumeJakeTemplate saves", () => {
    const violations = checkNoInventedExperience(studentResume, inventedStudentResume(), {
      applicationTarget: target,
      jobDescription: jdBackend,
    });
    expect(violations.some((violation) => /Northwind Payments/.test(violation.value))).toBe(true);
    expect(route()).toContain("createResumeJakeTemplate");
    expect(route()).toContain('model: "gpt-4o-mini"');
  });

  it("accepts a harmless rewrite in that same tool shape", () => {
    expect(
      checkNoInventedExperience(studentResume, rewordedStudentResume(), {
        applicationTarget: target,
        jobDescription: jdBackend,
      }),
    ).toEqual([]);
  });

  it("documents that extracted job keywords must be woven into the resume", () => {
    const src = route();
    expect(src).toContain("MUST integrate these naturally into the resume");
    expect(src).toContain("Weave them into bullet points, the skills section, and any summary");
    expect(src).toContain("These keywords were pulled directly from the job posting");
  });

  it.fails(
    "EXPECTED FAILURE: template resume prompt does not forbid invented experience and tells the model to integrate job-posting keywords",
    () => {
      const src = route();
      expect(src).not.toContain("MUST integrate these naturally into the resume");
      expect(src).toMatch(/job posting is not a source of facts about the candidate/i);
      expect(src).toMatch(/do not invent (employers|metrics|skills|schools|certifications)/i);
    },
  );

  it("documents that cover letters are written from the job and the user name, not a resume", () => {
    const src = route();
    expect(src).toContain("Use information from the job details to craft compelling content.");
    expect(src).toContain("createCoverLetterJakeTemplate");
  });

  it("catches a cover letter that turns the posting into the candidate's history", () => {
    const letter = {
      jobInfo: target.company ? { company: target.company, position: target.role } : undefined,
      letterContent: {
        openingParagraph: "I am applying for the Senior Backend Engineer role at Northwind Payments.",
        bodyParagraphs: [
          "I worked at Northwind Payments for 5 years, running Kubernetes on AWS and cutting latency 40%. I have an M.S. from Stanford University and I am an AWS Certified Solutions Architect.",
        ],
        closingParagraph: "Thank you for your time.",
      },
    };
    const harmless = {
      jobInfo: { company: target.company, position: target.role },
      letterContent: {
        openingParagraph: "I am applying for the Senior Backend Engineer role at Northwind Payments.",
        bodyParagraphs: [
          "I am a computer science student at State University and interned at City Library, where I wrote a Python script to sort summer reading signups.",
        ],
        closingParagraph: "Thank you for your time.",
      },
    };
    expect(checkNoInventedExperience(studentResume, harmless, { applicationTarget: target })).toEqual([]);
    expect(checkNoInventedExperience(studentResume, letter, { applicationTarget: target }).length).toBeGreaterThan(0);
  });

  it.fails(
    "EXPECTED FAILURE: cover letter prompt does not require the letter to stick to a real resume",
    () => {
      const src = route();
      expect(src).toMatch(/use only the candidate resume/i);
      expect(src).not.toContain("Use information from the job details to craft compelling content.");
    },
  );
});

describe("chat agent", () => {
  it("documents best practices that push invented numbers and job-description keywords", () => {
    expect(resumeBestPractices).toContain("Quantify achievements with numbers and percentages");
    expect(resumeBestPractices).toContain("Include relevant keywords from job descriptions");
    expect(jobKompassInstructions).toContain("createResumeJakeTemplate");
    expect(read("app/api/chat/route.ts")).toContain('model: "gpt-5-mini"');
    expect(read("app/ai/tools/file.ts")).toContain("name: 'createResumeJakeTemplate'");
  });

  it("catches an invented resume the chat tool would save", () => {
    const violations = checkNoInventedExperience(studentResume, inventedStudentResume(), {
      applicationTarget: target,
      jobDescription: jdBackend,
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it.fails(
    "EXPECTED FAILURE: chat instructions do not forbid invented employers, metrics, skills, schools, or certifications",
    () => {
      const text = `${jobKompassInstructions}\n${resumeBestPractices}`;
      expect(text).not.toContain("Quantify achievements with numbers and percentages");
      expect(text).not.toContain("Include relevant keywords from job descriptions");
      expect(text).toMatch(/do not invent/i);
    },
  );
});

describe("resume assistant", () => {
  it("catches invented companies and metrics in the updates block the editor applies", () => {
    const message = `Here is a stronger version.
\`\`\`updates
[
  { "type": "experience", "id": "exp1", "field": "company", "value": "Northwind Payments" },
  { "type": "experience", "id": "exp1", "field": "title", "value": "Senior Backend Engineer" },
  { "type": "experience_bullet", "experienceId": "exp1", "value": "Reduced API latency by 40% with Kubernetes" }
]
\`\`\``;
    const match = message.match(/```updates\s*([\s\S]*?)```/i);
    expect(match).toBeTruthy();
    const updates = JSON.parse(match![1]) as Array<{ type: string; field?: string; value: string }>;
    const edited = structuredClone(studentResume);
    for (const update of updates) {
      if (update.type === "experience" && update.field === "company") edited.experience[0].company = update.value;
      if (update.type === "experience" && update.field === "title") edited.experience[0].title = update.value;
      if (update.type === "experience_bullet") edited.experience[0].details.push(update.value);
    }
    const src = read("app/api/resume/assist/route.ts");
    expect(src).toContain("\\`\\`\\`updates");
    expect(src).toContain('model: \'gpt-5-mini\'');
    expect(src).toContain("Drove 20% growth");
    const violations = checkNoInventedExperience(studentResume, edited);
    expect(violations.map((violation) => violation.kind)).toEqual(
      expect.arrayContaining(["employer", "title", "metric", "skill"]),
    );
  });

  it("accepts an assistant bullet that only restates the internship", () => {
    const edited = structuredClone(studentResume);
    edited.experience[0].details.push("Helped patrons locate materials in the online catalog and shelved returned books");
    expect(checkNoInventedExperience(studentResume, edited)).toEqual([]);
  });

  it.fails(
    "EXPECTED FAILURE: resume assistant prompt uses invented metrics as examples and does not forbid new facts",
    () => {
      const src = read("app/api/resume/assist/route.ts");
      expect(src).not.toContain("Drove 20% growth");
      expect(src).toMatch(/do not invent/i);
    },
  );
});

describe("resume editor field generation", () => {
  const editor = () => read("app/jk-components/jk-chatwindow-components/jkChatWindow-ResumeEditor.tsx");

  it("documents prompts that ask for a new company, a new title, and measurable impact", () => {
    const src = editor();
    expect(src).toContain("Provide the name of a reputable company. Return the company name only.");
    expect(src).toContain("Craft a strong job title for this experience.");
    expect(src).toContain("highlights measurable impact");
    expect(src).toContain('fetch("/api/resume/assist"');
  });

  it("catches a generated company name and a generated metric bullet", () => {
    const withCompany = structuredClone(studentResume);
    withCompany.experience[0].company = "Google";
    const withBullet = structuredClone(studentResume);
    withBullet.experience[0].details = ["Increased catalog usage 40% by building a Kubernetes service"];
    expect(checkNoInventedExperience(studentResume, withCompany).some((violation) => violation.kind === "employer")).toBe(true);
    expect(checkNoInventedExperience(studentResume, withBullet).some((violation) => violation.kind === "metric")).toBe(true);
  });

  it.fails(
    "EXPECTED FAILURE: sparkle-button prompts ask the model to invent a company, a title, and measurable impact",
    () => {
      const src = editor();
      expect(src).not.toContain("reputable company");
      expect(src).not.toContain("measurable impact");
      expect(src).toMatch(/use only facts already in this resume/i);
    },
  );
});

describe("copy-to-external-AI prompts", () => {
  it("builds a resume prompt from the real helper, with no resume attached", () => {
    const prompt = getCopyPromptForTemplate("resume", "Senior Backend Engineer", "Northwind Payments");
    expect(prompt).toContain("Based on everything you know about me");
    expect(prompt).toContain("Company: Northwind Payments");
    expect(prompt).not.toContain("City Library");
  });

  it.fails(
    "EXPECTED FAILURE: copy-to-AI resume prompt invites outside knowledge instead of a supplied resume",
    () => {
      const prompt = getCopyPromptForTemplate("resume", "Senior Backend Engineer", "Northwind Payments");
      expect(prompt).not.toContain("Based on everything you know about me");
      expect(prompt).toMatch(/do not invent/i);
    },
  );
});

describe("paths that do not call a model", () => {
  it("agent API resume generation renders caller-supplied content and does not call a model", () => {
    const src = read("convex/agent/fns.ts");
    const start = src.indexOf("export const resumesGenerate");
    const end = src.indexOf("export const resumesReplaceGenerated");
    const slice = src.slice(start, end);
    expect(slice.length).toBeGreaterThan(50);
    expect(slice).not.toMatch(/openrouter|chat\/completions|new Agent\(/i);
  });

  it("pasted-text import is a deterministic parser with no model call", () => {
    const src = read("lib/resume/contentFromPastedText.ts");
    expect(src).toContain("No AI");
    expect(src).not.toMatch(/openrouter|chat\/completions/i);
  });

  it("documents a dormant Convex resume agent whose instructions are empty", () => {
    const src = read("convex/dopeAgents.ts");
    expect(src).toContain("name: 'Resume agent'");
    expect(src).toContain("instructions: ``");
  });
});
