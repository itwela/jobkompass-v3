import { describe, expect, it } from "vitest";
import { checkNoInventedExperience } from "./checker";
import { buildTailorSystemPrompt, RESUME_WRITING_STANDARD_BRIEF } from "../../lib/resume/writingStandard";

// Paraphrased, fictional Wellmark-style source. No live resume text.
const source = {
  personalInfo: {
    firstName: "Robin",
    lastName: "Example",
    email: "robin@example.com",
    summary: "Engineer shipping production AI software on AWS, including LLM pipelines on Amazon Bedrock.",
  },
  experience: [
    {
      company: "Northwind Labs",
      title: "AI Engineer",
      date: "Jan 2023 - Present",
      details: [
        "Built an internal AI platform for a small team that let leadership query company data conversationally, pairing RAG with custom connectors to internal systems",
        "Defined the AWS stack in AWS CDK across AWS Lambda, Amazon S3 and DynamoDB",
      ],
    },
  ],
  skills: { technical: ["TypeScript", "Node.js", "AWS CDK", "AWS Lambda", "Amazon S3", "DynamoDB", "RAG", "vector search", "Amazon Bedrock"] },
};

// A plain resume with no RAG, assistant or conversational work.
const plain = {
  personalInfo: { firstName: "Sam", lastName: "Sample", email: "sam@example.com", summary: "Backend engineer building billing services." },
  experience: [
    {
      company: "Contoso",
      title: "Software Engineer",
      date: "Jan 2021 - Present",
      details: ["Built billing services in Node.js on AWS Lambda", "Worked with the agents team on internal tooling"],
    },
  ],
  skills: { technical: ["Node.js", "TypeScript", "AWS Lambda"] },
};

const jd =
  "Must have Node.js/TypeScript, AWS API Gateway, AWS Lambda, Bedrock, CDK, Kubernetes, Terraform and 1+ yr Generative AI (RAG/search, chatbot/copilot, enterprise knowledge assistants).";
const opts = { jobDescription: jd, applicationTarget: { company: "Wellmark", role: "AI Engineer" } };

type R = typeof source;
function edit(base: R, f: (r: R) => void): R {
  const out = structuredClone(base);
  f(out);
  return out;
}

describe("fact guard: JD concept wording backed by resume evidence", () => {
  it("allows enterprise knowledge assistant and chatbot/copilot wording in a bullet", () => {
    const out = edit(source, (r) => {
      r.experience[0].details[0] =
        "Built an internal enterprise knowledge assistant, an AI chatbot/copilot that let leadership query company data conversationally, pairing RAG with custom connectors to internal systems";
    });
    expect(checkNoInventedExperience(source, out, opts)).toEqual([]);
  });

  it("allows the concept wording in the summary", () => {
    const out = edit(source, (r) => {
      r.personalInfo.summary =
        "Engineer shipping production AI software on AWS, including LLM pipelines on Amazon Bedrock. Built an enterprise knowledge assistant with Generative AI RAG/search.";
    });
    expect(checkNoInventedExperience(source, out, opts)).toEqual([]);
  });

  it("allows the concept wording in the skills section", () => {
    const out = edit(source, (r) => {
      r.skills.technical = [...r.skills.technical, "Generative AI RAG/search", "AI chatbot/copilot", "enterprise knowledge assistants"];
    });
    expect(checkNoInventedExperience(source, out, opts)).toEqual([]);
  });

  it("rejects the same concept wording when the resume shows no evidence of it", () => {
    for (const skill of ["AI chatbot/copilot", "enterprise knowledge assistants", "Generative AI RAG/search"]) {
      const out = { ...structuredClone(plain), skills: { technical: [...plain.skills.technical, skill] } };
      expect(checkNoInventedExperience(plain, out, opts).map((v) => v.value)).toContain(skill);
    }
    const bullet = structuredClone(plain);
    bullet.experience[0].details[1] = "Worked with the agents team on an enterprise knowledge assistant";
    expect(checkNoInventedExperience(plain, bullet, opts).some((v) => v.kind === "skill")).toBe(true);
  });

  it("still rejects Kubernetes and Terraform the resume does not show", () => {
    for (const skill of ["Kubernetes", "Terraform"]) {
      const out = edit(source, (r) => {
        r.skills.technical = [...r.skills.technical, skill];
      });
      expect(checkNoInventedExperience(source, out, opts).map((v) => v.value)).toContain(skill);
    }
    const bullet = edit(source, (r) => {
      r.experience[0].details[1] = "Defined the AWS stack in Terraform across AWS Lambda, Amazon S3 and DynamoDB";
    });
    expect(checkNoInventedExperience(source, bullet, opts).map((v) => v.value.toLowerCase())).toContain("terraform");
  });

  it("API Gateway: rejected when the resume does not show it", () => {
    const skills = edit(source, (r) => {
      r.skills.technical = [...r.skills.technical, "AWS API Gateway"];
    });
    expect(checkNoInventedExperience(source, skills, opts).map((v) => v.value)).toContain("AWS API Gateway");
    const bullet = edit(source, (r) => {
      r.experience[0].details[1] = "Defined the AWS stack in AWS CDK across AWS API Gateway, AWS Lambda, Amazon S3 and DynamoDB";
    });
    expect(checkNoInventedExperience(source, bullet, opts).map((v) => v.value)).toContain("api gateway");
  });

  it("API Gateway: allowed once the resume shows it", () => {
    const withGateway = edit(source, (r) => {
      r.skills.technical = [...r.skills.technical, "API Gateway"];
      r.experience[0].details.push("Exposed Lambda functions to internal clients through API Gateway");
    });
    const out = edit(withGateway, (r) => {
      r.skills.technical = r.skills.technical.map((s) => (s === "API Gateway" ? "AWS API Gateway" : s));
      r.experience[0].details[2] = "Exposed AWS Lambda functions to internal clients through AWS API Gateway";
    });
    expect(checkNoInventedExperience(withGateway, out, opts)).toEqual([]);
  });

  it("the posting is never an allowlist: concept words in the JD alone do not unlock them", () => {
    const out = { ...structuredClone(plain), skills: { technical: [...plain.skills.technical, "chatbot/copilot"] } };
    const withJdInSource = checkNoInventedExperience(plain, out, { ...opts, jobDescription: `${jd} chatbot/copilot chatbot/copilot` });
    expect(withJdInSource.map((v) => v.value)).toContain("chatbot/copilot");
  });
});

describe("tailor prompt: exact posting wording for concepts and role phrases", () => {
  const prompt = buildTailorSystemPrompt();

  it("extends the exact-wording rule to concepts in bullets, summary and skills", () => {
    expect(prompt).toContain("CONCEPTS AND ROLE PHRASES TOO");
    expect(prompt).toContain("in the bullets, in the summary and in the skills section");
    expect(prompt).toContain('"enterprise knowledge assistant"');
    expect(prompt).toContain('"AI chatbot/copilot"');
    expect(prompt).toContain('"Generative AI RAG/search"');
  });

  it("the summary rule asks for the posting's wording of concepts the resume shows", () => {
    expect(prompt).toMatch(/summary[^\n]*must-have tools and concepts the resume shows, in the posting's exact wording/);
  });

  it("still forbids a concept the resume has no evidence of", () => {
    expect(prompt).toContain("A concept the resume shows no evidence of stays out");
    expect(prompt).toContain("Never add a skill the resume does not show");
  });

  it("the short standard carries the concept rule too", () => {
    expect(RESUME_WRITING_STANDARD_BRIEF).toContain("CONCEPTS AND ROLE PHRASES TOO");
  });
});
