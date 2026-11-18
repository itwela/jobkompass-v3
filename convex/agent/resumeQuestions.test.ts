import { describe, expect, it } from "vitest";
import { questionId } from "../../lib/resume/bulletQuestions";
import {
  mustHavesCoverage,
  pointQuestionsAt,
  resolveAnswers,
  scorecardFor,
  templatedQuestionText,
  templatedQuestions,
} from "./resumeQuestions";

const resume = {
  personalInfo: { firstName: "A", lastName: "B", email: "a@b.c" },
  experience: [
    {
      company: "Acme",
      title: "Support Lead",
      date: "2022 – 2024",
      details: [
        "Responsible for handling customer tickets",
        "Reduced response time by 40%",
        "Led onboarding for new hires",
      ],
    },
  ],
  projects: [{ name: "Tool", description: "x", details: ["Built an internal dashboard in React"] }],
  skills: { technical: ["React", "SQL"] },
};

describe("templatedQuestions", () => {
  it("asks only about bullets without a number, with stable ids", () => {
    const qs = templatedQuestions(resume);
    expect(qs.map((q) => q.bullet)).toEqual([
      "Responsible for handling customer tickets",
      "Led onboarding for new hires",
      "Built an internal dashboard in React",
    ]);
    expect(qs[0].id).toBe(questionId("experience", 0, "Responsible for handling customer tickets"));
    expect(qs.every((q) => q.question.endsWith("?"))).toBe(true);
  });

  it("skips answered bullets and respects the limit", () => {
    const answers = [{ section: "experience" as const, index: 0, bullet: "Responsible for handling customer tickets", answer: "40 a day" }];
    expect(templatedQuestions(resume, answers).map((q) => q.index + q.section)).toEqual(["0experience", "0projects"]);
    expect(templatedQuestions(resume, [], 1)).toHaveLength(1);
  });

  it("question text never contains a number of its own", () => {
    for (const b of ["Reduced costs", "Grew the list", "Led a team", "Served customers", "Closed deals", "Built a tool", "Did stuff"]) {
      expect(/\d/.test(templatedQuestionText(b).question)).toBe(false);
    }
  });

  it("returns nothing for empty or odd content", () => {
    expect(templatedQuestions({})).toEqual([]);
    expect(templatedQuestions(null as any)).toEqual([]);
  });
});

describe("pointQuestionsAt", () => {
  it("re-points model questions at the submitted bullet and drops unknown items", () => {
    const qs = pointQuestionsAt(resume, [
      { id: "x", section: "experience", index: 0, bullet: "Resolved customer support tickets quickly", question: "How many tickets a day?" },
      { id: "y", section: "experience", index: 7, bullet: "nope", question: "?" },
    ]);
    expect(qs).toHaveLength(1);
    expect(qs[0].bullet).toBe("Responsible for handling customer tickets");
    expect(qs[0].id).toBe(questionId("experience", 0, "Responsible for handling customer tickets"));
  });
});

describe("resolveAnswers", () => {
  it("resolves question ids and passes explicit answers through", () => {
    const id = questionId("projects", 0, "Built an internal dashboard in React");
    const { answers, unresolved } = resolveAnswers(resume, [
      { id, answer: "used by 30 staff" },
      { id: "experience-9-zzz", answer: "x" },
      { section: "experience", index: 0, bullet: "Led onboarding for new hires", answer: "12 hires" },
      { section: "experience", index: 0, bullet: "Led onboarding", answer: "   " },
    ]);
    expect(unresolved).toEqual(["experience-9-zzz"]);
    expect(answers).toEqual([
      { section: "projects", index: 0, bullet: "Built an internal dashboard in React", answer: "used by 30 staff" },
      { section: "experience", index: 0, bullet: "Led onboarding for new hires", answer: "12 hires" },
    ]);
  });

  it("ignores non-arrays", () => {
    expect(resolveAnswers(resume, "nope")).toEqual({ answers: [], unresolved: [] });
  });
});

describe("scorecard", () => {
  it("counts bullets and checks must-haves literally", () => {
    expect(mustHavesCoverage(resume, { skills: ["React", "Kubernetes"], keywords: ["react", "SQL"] })).toEqual({
      met: ["React", "SQL"],
      missing: ["Kubernetes"],
    });
    const card = scorecardFor(resume, { skills: ["React", "Kubernetes"] });
    expect(card.bullets).toBe(4);
    expect(card.quantified).toBe(1);
    expect(card.mustHaves).toEqual({ met: 1, total: 2, missing: ["Kubernetes"] });
    expect(scorecardFor(resume).mustHaves).toBeUndefined();
  });
});
