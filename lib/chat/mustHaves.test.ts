import { afterEach, describe, expect, it, vi } from "vitest";
import { mentions, mustHavesForJob, mustHavesKey, resumeText, scoreMustHaves, storedMustHaves, stripVendor } from "./mustHaves";
import { mustHavesCoverage } from "../../convex/agent/resumeQuestions";

// Fixture shaped like Summit's base resume for the Wellmark job (live records not read).
const summitBase = {
  personalInfo: { firstName: "Summit", lastName: "Career", summary: "Engineer building large language model products." },
  experience: [
    {
      company: "Acme",
      title: "Software Engineer",
      date: "2022 - Present",
      details: [
        "Built AI agents on Bedrock that triage support tickets",
        "Shipped Lambda functions in Node.js and TypeScript writing to S3 and DynamoDB",
      ],
    },
  ],
  skills: { technical: ["Node.js", "TypeScript", "Bedrock", "Lambda", "S3", "DynamoDB", "Python"] },
};

const wellmarkMustHaves = [
  "Node.js/TypeScript",
  "AWS Bedrock",
  "AWS Lambda",
  "AWS S3",
  "Amazon S3",
  "AWS DynamoDB",
  "LLM",
  "agentic",
  "Kubernetes",
];

describe("scoreMustHaves: Wellmark-style must-haves", () => {
  it("meets slash, vendor-prefixed and aliased terms the base resume shows", () => {
    const out = scoreMustHaves(wellmarkMustHaves, { base: summitBase, answers: [] });
    expect(out.met).toEqual(["Node.js/TypeScript", "AWS Bedrock", "AWS Lambda", "AWS S3", "Amazon S3", "AWS DynamoDB", "LLM", "agentic"]);
    expect(out.missing).toEqual(["Kubernetes"]);
    expect(out.total).toBe(9);
  });

  it("a slash term needs every part", () => {
    const hay = resumeText({ skills: ["Node.js"] });
    expect(mentions(hay, "Node.js/TypeScript")).toBe(false);
    expect(mentions(resumeText({ skills: ["Node.js", "TypeScript"] }), "Node.js/TypeScript")).toBe(true);
  });

  it("keeps a whole slash term like CI/CD whole", () => {
    expect(mentions(resumeText(["Set up CI/CD with GitHub Actions"]), "CI/CD")).toBe(true);
  });

  it("does not let Java match inside JavaScript, even with the new rules", () => {
    const hay = resumeText({ skills: ["JavaScript", "TypeScript"] });
    expect(mentions(hay, "Java")).toBe(false);
    expect(mentions(hay, "Java/Spring")).toBe(false);
    expect(mentions(hay, "Oracle Java")).toBe(false);
  });

  it("vendor stripping needs the product: AWS alone does not meet AWS Lambda", () => {
    const hay = resumeText(["Deployed on AWS EC2"]);
    expect(mentions(hay, "AWS Lambda")).toBe(false);
    expect(mentions(hay, "AWS")).toBe(true);
  });

  it("aliases work both ways and stay whole-word", () => {
    expect(mentions(resumeText(["Fine-tuned LLMs"]), "large language models")).toBe(true);
    expect(mentions(resumeText(["Built agentic workflows"]), "AI agents")).toBe(true);
    expect(mentions(resumeText(["Worked with the agents team"]), "agentic")).toBe(false);
    expect(mentions(resumeText(["Used xllm tooling"]), "LLM")).toBe(false);
  });

  it("strips only real vendor prefixes", () => {
    expect(stripVendor("AWS Lambda")).toBe("Lambda");
    expect(stripVendor("Amazon S3")).toBe("S3");
    expect(stripVendor("AWS")).toBeNull();
    expect(stripVendor("Lambda")).toBeNull();
  });

  it("scores the base resume and answers, not a rewrite", () => {
    const out = scoreMustHaves(["AWS Lambda"], { base: { skills: ["Python"] }, answers: ["I wrote Lambda handlers"] });
    expect(out.met).toEqual(["AWS Lambda"]);
  });
});

describe("agent baseScorecard uses the same matcher", () => {
  it("mustHavesCoverage meets vendor-prefixed and aliased job skills", () => {
    const cov = mustHavesCoverage(summitBase as any, { skills: ["AWS Lambda", "Amazon S3", "LLM", "Java"] });
    expect(cov).toMatchObject({ met: ["AWS Lambda", "Amazon S3", "LLM"], missing: ["Java"] });
    expect(cov!.matched.map((m) => m.term)).toEqual(["AWS Lambda", "Amazon S3", "LLM"]);
    expect(cov!.matched[0].evidence).toMatch(/Lambda/);
    expect(cov!.matched[1].evidence).toMatch(/S3/);
    expect(cov!.matched[2].evidence).toMatch(/large language model/);
  });
});

describe("stable must-have list", () => {
  const description = "We need Node.js/TypeScript, AWS Bedrock, AWS Lambda and LLM experience. ".repeat(3);

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("the key is stable under whitespace and changes with the text", () => {
    expect(mustHavesKey(description)).toBe(mustHavesKey(`  ${description.replace(/ /g, "  ")}\n`));
    expect(mustHavesKey(description)).not.toBe(mustHavesKey(description + " Kubernetes."));
  });

  it("reuses the stored list for the same description without calling the model", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const job = { description, mustHaves: ["AWS Lambda", "aws lambda", " LLM "], mustHavesKey: mustHavesKey(description) };
    expect(await mustHavesForJob(job)).toEqual(["AWS Lambda", "LLM"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores a stored list from an older description", () => {
    expect(storedMustHaves({ description, mustHaves: ["X"], mustHavesKey: mustHavesKey("old text") })).toBeNull();
  });

  it("extracts once at temperature 0 and saves the list", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: any) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ mustHaves: ["AWS Lambda", "LLM"] }) } }] }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const save = vi.fn(async () => undefined);
    expect(await mustHavesForJob({ description }, save)).toEqual(["AWS Lambda", "LLM"]);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).temperature).toBe(0);
    expect(save).toHaveBeenCalledWith(["AWS Lambda", "LLM"], mustHavesKey(description));
  });

  it("never stores the keyword fallback", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const save = vi.fn(async () => undefined);
    expect(await mustHavesForJob({ description, skills: ["Python"] }, save)).toEqual(["Python"]);
    expect(save).not.toHaveBeenCalled();
  });
});
