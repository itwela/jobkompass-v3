import { describe, expect, it } from "vitest";
import { conceptFor, matchMustHave, mentions, resumeText, scoreMustHaves } from "./mustHaves";
import { scoreResume } from "../resume/scorecard";

// Paraphrased, fictional fixture shaped like the Wellmark base resume. No live text.
export const wellmarkStyleBase = {
  personalInfo: {
    firstName: "Robin",
    lastName: "Example",
    summary: "Engineer shipping production AI software on AWS, including LLM pipelines on Amazon Bedrock.",
  },
  experience: [
    {
      company: "Northwind Labs",
      title: "AI Engineer",
      date: "2023 - Present",
      details: [
        "Built an internal AI platform for a small team that let leadership query company data conversationally, pairing RAG with custom connectors to internal systems",
        "Ran LLM pipelines on Amazon Bedrock for document summarization",
        "Defined the AWS stack in AWS CDK across AWS Lambda, Amazon S3, DynamoDB and PostgreSQL",
      ],
    },
  ],
  skills: {
    technical: [
      "TypeScript", "Node.js", "AWS CDK", "AWS Lambda", "Amazon S3", "PostgreSQL", "DynamoDB",
      "Pinecone", "RAG", "vector search", "Amazon Bedrock", "Figma",
    ],
  },
};

/** The 10 must-haves stored on the Wellmark job. */
export const wellmarkMustHaves = [
  "Node.js", "TypeScript", "AWS Bedrock", "AWS CDK", "Generative AI RAG/search", "chatbot/copilot",
  "enterprise knowledge assistants", "AWS Lambda", "AWS API Gateway", "AWS DynamoDB",
];

const withApiGateway = () => {
  const r = structuredClone(wellmarkStyleBase);
  r.skills.technical.push("AWS API Gateway");
  r.experience[0].details.push("Exposed AWS Lambda functions to internal clients through API Gateway");
  return r;
};

const evidenceOf = (out: ReturnType<typeof scoreMustHaves>, term: string) =>
  out.matched?.find((m) => m.term === term)?.evidence;

describe("concept must-haves on the Wellmark-style fixture", () => {
  it("meets the three concept terms with evidence; API Gateway stays missing on the current text", () => {
    const out = scoreMustHaves(wellmarkMustHaves, { base: wellmarkStyleBase, answers: [] });
    expect(out.missing).toEqual(["AWS API Gateway"]);
    expect(out.met).toEqual(wellmarkMustHaves.filter((t) => t !== "AWS API Gateway"));
    expect(out.total).toBe(10);
    expect(out.matched!.map((m) => m.term)).toEqual(out.met);

    expect(evidenceOf(out, "Generative AI RAG/search")).toMatch(/RAG/);
    expect(evidenceOf(out, "chatbot/copilot")).toMatch(/query company data conversationally/);
    expect(evidenceOf(out, "enterprise knowledge assistants")).toMatch(/internal AI platform/);
    expect(evidenceOf(out, "AWS Lambda")).toMatch(/Lambda/);
    for (const m of out.matched!) expect(m.evidence.length).toBeLessThanOrEqual(160);
  });

  it("meets AWS API Gateway once the resume shows it, with evidence", () => {
    const out = scoreMustHaves(wellmarkMustHaves, { base: withApiGateway(), answers: [] });
    expect(out.missing).toEqual([]);
    expect(out.met).toHaveLength(10);
    expect(evidenceOf(out, "AWS API Gateway")).toMatch(/API Gateway/);
  });

  it("a candidate answer can show API Gateway too (base plus answers, never the rewrite)", () => {
    const out = scoreMustHaves(["AWS API Gateway"], { base: wellmarkStyleBase, answers: ["I put API Gateway in front of the Lambda functions"] });
    expect(out.met).toEqual(["AWS API Gateway"]);
  });

  it("Kubernetes and Terraform stay missing", () => {
    const out = scoreMustHaves(["Kubernetes", "Terraform"], { base: withApiGateway(), answers: [] });
    expect(out.met).toEqual([]);
    expect(out.missing).toEqual(["Kubernetes", "Terraform"]);
    expect(out.matched).toEqual([]);
  });

  it("keeps met and missing as plain string arrays the scorecard reads as before", () => {
    const out = scoreMustHaves(wellmarkMustHaves, { base: wellmarkStyleBase, answers: [] });
    const card = scoreResume(wellmarkStyleBase, { mustHaves: { met: out.met, missing: out.missing } });
    expect(card.mustHaves).toEqual({ met: 9, total: 10, missing: ["AWS API Gateway"] });
    const withEvidence = scoreResume(wellmarkStyleBase, { mustHaves: out });
    expect(withEvidence.mustHaves).toMatchObject({ met: 9, total: 10, missing: ["AWS API Gateway"] });
    expect(withEvidence.mustHaves!.matched).toEqual(out.matched);
  });
});

describe("concept matching stays strict", () => {
  const hay = (...lines: string[]) => resumeText(lines);

  it("a bare 'search' or 'AI' does not meet Generative AI RAG/search", () => {
    expect(mentions(hay("Improved search ranking for the storefront"), "Generative AI RAG/search")).toBe(false);
    expect(mentions(hay("Built AI features for marketing"), "Generative AI RAG/search")).toBe(false);
    expect(mentions(hay("Used generative AI to draft copy", "Tuned site search"), "Generative AI RAG/search")).toBe(false);
    expect(mentions(hay("Added vector search over support articles"), "Generative AI RAG/search")).toBe(true);
    expect(mentions(hay("Shipped retrieval-augmented generation for docs"), "Generative AI RAG/search")).toBe(true);
  });

  it("chatbot/copilot needs conversational or assistant evidence, not 'agent' or 'team'", () => {
    expect(mentions(hay("Worked with the agents team on AI tooling"), "chatbot/copilot")).toBe(false);
    expect(mentions(hay("Built a support agent dashboard"), "chatbot/copilot")).toBe(false);
    expect(mentions(hay("Led a team of five"), "chatbot/copilot")).toBe(false);
    expect(mentions(hay("Launched a chatbot for billing questions"), "chatbot/copilot")).toBe(true);
    expect(mentions(hay("Shipped a Bedrock assistant that answers member questions"), "chatbot/copilot")).toBe(true);
    expect(mentions(hay("Let staff query reports conversationally"), "chatbot/copilot")).toBe(true);
  });

  it("enterprise knowledge assistants needs an internal AI tool for querying company knowledge", () => {
    expect(mentions(hay("Built an internal admin portal"), "enterprise knowledge assistants")).toBe(false);
    expect(mentions(hay("Built an AI app for consumers to search recipes"), "enterprise knowledge assistants")).toBe(false);
    expect(mentions(hay("Built an internal LLM tool so employees can search company documents"), "enterprise knowledge assistants")).toBe(true);
  });

  it("keeps CI/CD whole and Java out of JavaScript", () => {
    expect(mentions(hay("Set up CI/CD with GitHub Actions"), "CI/CD")).toBe(true);
    expect(mentions(hay("Set up CI with GitHub Actions"), "CI/CD")).toBe(false);
    expect(mentions(resumeText({ skills: ["JavaScript"] }), "Java")).toBe(false);
  });

  it("recognises plural and spacing variants of a concept name", () => {
    expect(conceptFor("Enterprise Knowledge Assistants")).not.toBeNull();
    expect(conceptFor("chatbot / copilot")).not.toBeNull();
    expect(conceptFor("search")).toBeNull();
    expect(conceptFor("AI")).toBeNull();
  });

  it("evidence is a short snippet, not the whole resume", () => {
    const long = `${"Context sentence about earlier work. ".repeat(8)}Then shipped a chatbot for claims. ${"More detail follows here. ".repeat(8)}`;
    const ev = matchMustHave({ details: [long] }, "chatbot/copilot")!;
    expect(ev).toMatch(/chatbot/);
    expect(ev.length).toBeLessThan(long.length);
    expect(ev.length).toBeLessThanOrEqual(150);
  });
});
