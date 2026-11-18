import { describe, expect, it } from "vitest";
import {
  bulletHasNumber,
  restoreDroppedBullets,
  restoreStructure,
  sameStructure,
  sanitizeAnswers,
  sanitizeQuestions,
  sourceWithAnswers,
  stripAnswerLines,
  unquantifiedBullets,
} from "./bulletQuestions";
import { scrubInventedExperience } from "./noInventedFacts";
import { buildTailorSystemPrompt } from "./writingStandard";
import { resumeWriterModels } from "../aiModels";

const base = {
  personalInfo: { firstName: "Jordan", lastName: "Avery", email: "jordan@example.com" },
  experience: [
    {
      company: "Northgate Logistics",
      title: "Software Developer",
      date: "Mar 2024 - Present",
      details: [
        "Responsible for managing weekly deployments",
        "Worked on the backend API for the driver mobile app using Python and FastAPI",
        "Built an internal dashboard in React that dispatchers use to assign 1,200 daily deliveries",
      ],
    },
    {
      company: "Peachtree Dental Group",
      title: "IT Support Specialist",
      date: "Jun 2022 - Feb 2024",
      details: ["Wrote Python scripts to automate patient appointment reminder emails"],
    },
  ],
  projects: [{ name: "BudgetBuddy", description: "Personal finance tracker", details: ["Has user login and charts"] }],
  skills: { technical: ["Python", "FastAPI", "React"], additional: [] },
};

describe("bulletHasNumber", () => {
  it("sees digits and spelled-out quantities", () => {
    expect(bulletHasNumber("Assigns 1,200 daily deliveries")).toBe(true);
    expect(bulletHasNumber("Won three hackathons")).toBe(true);
    expect(bulletHasNumber("Managed weekly deployments")).toBe(false);
  });

  it("lists the bullets that still have no number", () => {
    expect(unquantifiedBullets(base).map((b) => b.bullet)).toEqual([
      "Responsible for managing weekly deployments",
      "Worked on the backend API for the driver mobile app using Python and FastAPI",
      "Wrote Python scripts to automate patient appointment reminder emails",
      "Has user login and charts",
    ]);
  });
});

describe("sanitizeQuestions", () => {
  const tailored = structuredClone(base);
  tailored.experience[0].details[1] = "Built the backend API for the driver mobile app in Python and FastAPI";

  it("keeps a question that points at a real bullet and ties it to the returned wording", () => {
    const out = sanitizeQuestions(
      [{ section: "experience", index: 0, bullet: "Built the backend API for the driver mobile app in Python and FastAPI", question: "How many drivers use the app", example: "about 300 drivers" }],
      tailored,
    );
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe("How many drivers use the app?");
    expect(out[0].bullet).toBe(tailored.experience[0].details[1]);
    expect(out[0].id).toMatch(/^experience-0-/);
  });

  it("drops questions about bullets that do not exist, bad indexes and junk", () => {
    const out = sanitizeQuestions(
      [
        { section: "experience", index: 0, bullet: "Led a team of 40 engineers at Google", question: "How big was the team?" },
        { section: "experience", index: 9, bullet: "Responsible for managing weekly deployments", question: "How many?" },
        { section: "education", index: 0, bullet: "x", question: "What GPA?" },
        "nonsense",
        null,
      ],
      tailored,
    );
    expect(out).toEqual([]);
  });

  it("does not ask again about an answered bullet, removes duplicates and caps at five", () => {
    const many = Array.from({ length: 8 }, () => ({ section: "experience", index: 0, bullet: "Responsible for managing weekly deployments", question: "How often?" }));
    expect(sanitizeQuestions(many, tailored)).toHaveLength(1);
    const answered = sanitizeQuestions(many, tailored, [
      { section: "experience", index: 0, bullet: "Responsible for managing weekly deployments", answer: "weekly, no rollbacks in 8 months" },
    ]);
    expect(answered).toEqual([]);
  });

  it("returns nothing for a non-array", () => {
    expect(sanitizeQuestions(undefined, tailored)).toEqual([]);
    expect(sanitizeQuestions({ questions: [] }, tailored)).toEqual([]);
  });
});

describe("sanitizeAnswers", () => {
  it("keeps short, well-formed answers only", () => {
    const out = sanitizeAnswers([
      { section: "experience", index: 0, bullet: "Worked on the backend API", answer: "  about 340 drivers a day  " },
      { section: "experience", index: 0, bullet: "Worked on the backend API", answer: "" },
      { section: "skills", index: 0, bullet: "x", answer: "y" },
      { section: "projects", index: -1, bullet: "x", answer: "y" },
    ]);
    expect(out).toEqual([{ section: "experience", index: 0, bullet: "Worked on the backend API", answer: "about 340 drivers a day" }]);
  });
});

describe("answers and the fact guard", () => {
  const answer = { section: "experience" as const, index: 0, bullet: base.experience[0].details[1], answer: "about 340 drivers use it every day" };
  const rewritten = structuredClone(base);
  rewritten.experience[0].details[1] = "Built the backend API for the driver mobile app in Python and FastAPI, used by about 340 drivers every day";

  it("lets a number through when the candidate supplied it", () => {
    const source = sourceWithAnswers(base, [answer]);
    const out = scrubInventedExperience(source, rewritten) as typeof base;
    expect(out.experience[0].details).toContain(rewritten.experience[0].details[1]);
  });

  it("still strips that number when no answer backs it", () => {
    const out = scrubInventedExperience(base, rewritten) as typeof base;
    expect(JSON.stringify(out)).not.toContain("340");
  });

  it("does not change the base resume when adding answers", () => {
    const before = JSON.stringify(base);
    sourceWithAnswers(base, [answer]);
    expect(JSON.stringify(base)).toBe(before);
    expect(sourceWithAnswers(base, [])).toBe(base);
  });
});

describe("stripAnswerLines", () => {
  it("removes a bullet that is only the raw answer text and keeps the rewritten one", () => {
    const answer = { section: "experience" as const, index: 0, bullet: base.experience[0].details[0], answer: "Cut deploy time from 2 hours to 20 minutes" };
    const out = structuredClone(base);
    out.experience[0].details = ["Cut deployment time from 2 hours to 20 minutes", ...base.experience[0].details.slice(1), "cut deploy time from 2 hours  to 20 minutes"];
    const stripped = stripAnswerLines(out, [answer]);
    expect(stripped.experience[0].details).toHaveLength(3);
    expect(stripped.experience[0].details[0]).toBe("Cut deployment time from 2 hours to 20 minutes");
    expect(stripAnswerLines(out, [])).toBe(out);
  });

  it("the guarded output for an answered resume has no extra bullet", () => {
    const answer = { section: "experience" as const, index: 0, bullet: base.experience[0].details[1], answer: "about 340 drivers use it every day" };
    const rewritten = structuredClone(base);
    rewritten.experience[0].details[1] = "Built the backend API for the driver mobile app in Python and FastAPI, used by about 340 drivers every day";
    const guarded = scrubInventedExperience(sourceWithAnswers(base, [answer]), rewritten) as typeof base;
    const final = restoreDroppedBullets(base, stripAnswerLines(guarded, [answer]));
    expect(final.experience[0].details).toHaveLength(base.experience[0].details.length);
  });
});

describe("restoreDroppedBullets", () => {
  it("puts back the candidate's own bullet when the guard removed its rewrite", () => {
    const tailored = structuredClone(base);
    tailored.experience[0].details = [
      "Built a React dashboard that dispatchers use to assign 1,200 daily deliveries",
      "Built the backend API for the driver mobile app in Python and FastAPI",
    ];
    const out = restoreDroppedBullets(base, tailored);
    expect(out.experience[0].details).toEqual([...tailored.experience[0].details, "Responsible for managing weekly deployments"]);
  });

  it("leaves a complete item alone", () => {
    const tailored = structuredClone(base);
    expect(restoreDroppedBullets(base, tailored)).toEqual(tailored);
  });
});

describe("sameStructure", () => {
  it("accepts reworded bullets and rejects a renamed, reordered or dropped job", () => {
    const reworded = structuredClone(base);
    reworded.experience[0].details = ["Something else"];
    expect(sameStructure(base, reworded)).toBe(true);

    const reordered = structuredClone(base);
    reordered.experience.reverse();
    expect(sameStructure(base, reordered)).toBe(false);

    const dropped = structuredClone(base);
    dropped.experience.pop();
    expect(sameStructure(base, dropped)).toBe(false);

    const renamed = structuredClone(base);
    renamed.experience[0].title = "Senior Software Engineer";
    expect(sameStructure(base, renamed)).toBe(false);
  });
});

describe("writing standard and writer models", () => {
  it("includes the answer rules only when there are answers", () => {
    expect(buildTailorSystemPrompt()).not.toContain("CANDIDATE ANSWERS");
    expect(buildTailorSystemPrompt({ withAnswers: true })).toContain("CANDIDATE ANSWERS");
    expect(buildTailorSystemPrompt()).toContain("If a bullet has no number, do not give it one");
  });

  it("gives paid plans the premium writer with the standard one as fallback", () => {
    expect(resumeWriterModels(false)).toHaveLength(1);
    const paid = resumeWriterModels(true);
    expect(paid).toHaveLength(2);
    expect(paid[1]).toBe(resumeWriterModels(false)[0]);
  });
});

describe("restoreStructure", () => {
  it("brings back a project the guard removed, in the base order", () => {
    const two = { ...base, projects: [...base.projects, { name: "Lotus - iOS App", description: "Wellness app", details: ["Shipped to the App Store"] }] };
    const tailored = structuredClone(two);
    tailored.projects = [{ name: "Lotus - iOS App", description: "Wellness app for this role", details: ["Shipped to the App Store"] }];
    const out = restoreStructure(two, tailored);
    expect(out.projects.map((p: any) => p.name)).toEqual(["BudgetBuddy", "Lotus - iOS App"]);
    expect(out.projects[0]).toEqual(two.projects[0]);
    expect(out.projects[1].description).toBe("Wellness app for this role");
  });

  it("keeps rewritten bullets but takes names, titles and dates from the base", () => {
    const tailored = structuredClone(base);
    tailored.experience[0].title = "Senior Software Engineer";
    tailored.experience[0].company = "Northgate Logistics";
    tailored.experience[0].details = ["Rewritten bullet"];
    const out = restoreStructure(base, { ...tailored, experience: [{ ...tailored.experience[0], title: base.experience[0].title }, tailored.experience[1]] });
    expect(out.experience[0].title).toBe("Software Developer");
    expect(out.experience[0].details).toEqual(["Rewritten bullet"]);
  });

  it("treats punctuation differences in a name as the same item", () => {
    const tailored = structuredClone(base);
    tailored.projects[0].name = "BudgetBuddy.";
    expect(sameStructure(base, tailored)).toBe(true);
    expect(restoreStructure(base, tailored).projects[0].name).toBe("BudgetBuddy");
  });
});
