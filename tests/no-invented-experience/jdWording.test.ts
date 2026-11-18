import { describe, expect, it } from "vitest";
import { checkNoInventedExperience } from "./checker";
import { buildTailorSystemPrompt, RESUME_WRITING_STANDARD_BRIEF } from "../../lib/resume/writingStandard";

// Source resume uses the short names; the posting (Wellmark-style) uses vendor-prefixed ones.
const source = {
  personalInfo: { firstName: "Summit", lastName: "Career", email: "s@example.com", summary: "Engineer building large language model products." },
  experience: [
    {
      company: "Acme Health",
      title: "Software Engineer",
      date: "Jan 2022 - Present",
      details: [
        "Built Lambda functions in Node.js that write claims files to S3",
        "Shipped a Bedrock assistant that answers member questions",
      ],
    },
  ],
  skills: { technical: ["Node.js", "TypeScript", "Lambda", "S3", "Bedrock", "DynamoDB"] },
};

const jd = "Must have AWS Lambda, Amazon S3, AWS Bedrock, LLM experience, Kubernetes and Terraform.";
const opts = { jobDescription: jd, applicationTarget: { company: "Wellmark", role: "AI Engineer" } };

function withSkills(skills: string[], details?: string[]) {
  const out = structuredClone(source);
  out.skills.technical = skills;
  if (details) out.experience[0].details = details;
  return out;
}

describe("fact guard: JD wording of a skill the resume already has", () => {
  it("allows AWS Lambda / Amazon S3 / AWS Bedrock / LLM in the skills section", () => {
    const out = withSkills(["Node.js", "TypeScript", "AWS Lambda", "Amazon S3", "AWS Bedrock", "AWS DynamoDB", "LLM"]);
    expect(checkNoInventedExperience(source, out, opts)).toEqual([]);
  });

  it("allows the vendor-prefixed names in bullets", () => {
    const out = withSkills(source.skills.technical, [
      "Built AWS Lambda functions in Node.js that write claims files to Amazon S3",
      "Shipped an AWS Bedrock assistant that answers member questions",
    ]);
    expect(checkNoInventedExperience(source, out, opts)).toEqual([]);
  });

  it("still rejects a skill the resume does not have, however the posting words it", () => {
    for (const skill of ["Kubernetes", "Terraform", "AWS EKS", "Amazon Kinesis"]) {
      const violations = checkNoInventedExperience(source, withSkills([...source.skills.technical, skill]), opts);
      expect(violations.map((v) => v.value)).toContain(skill);
    }
  });

  it("still rejects AWS on its own when the resume never names AWS", () => {
    const violations = checkNoInventedExperience(source, withSkills([...source.skills.technical, "AWS"]), opts);
    expect(violations.map((v) => v.value)).toContain("AWS");
  });

  it("still rejects a bullet that adds an unknown tool behind the vendor word", () => {
    const out = withSkills(source.skills.technical, [
      "Built Lambda functions in Node.js that write claims files to S3 using AWS Kubernetes",
      "Shipped a Bedrock assistant that answers member questions",
    ]);
    expect(checkNoInventedExperience(source, out, opts).some((v) => v.kind === "skill")).toBe(true);
  });
});

describe("tailor prompt: exact posting wording", () => {
  const prompt = buildTailorSystemPrompt();

  it("requires the posting's exact wording, casing and phrasing for skills the candidate has", () => {
    expect(prompt).toContain("posting's exact wording, casing and phrasing");
    expect(prompt).toContain('write "AWS Lambda"');
    expect(prompt).toContain('write "Amazon S3"');
    expect(prompt).toMatch(/skills section and in the bullets/);
  });

  it("still forbids adding skills the candidate lacks", () => {
    expect(prompt).toContain("Never add a skill, tool or technology the resume does not show");
    expect(prompt).toContain("The resume is the only source of facts about the candidate.");
  });

  it("the short standard used by chat and editor prompts carries the same rule", () => {
    expect(RESUME_WRITING_STANDARD_BRIEF).toContain("posting's exact wording, casing and phrasing");
  });
});
