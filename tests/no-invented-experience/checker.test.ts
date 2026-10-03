import { describe, expect, it } from "vitest";
import { checkNoInventedExperience, type ViolationKind } from "./checker";
import {
  careerChangerResume,
  jdBackend,
  resumeToPlainText,
  rewordedStudentResume,
  sparseResume,
  studentResume,
} from "./fixtures";

function kinds(input: unknown, output: unknown, jobDescription?: string): ViolationKind[] {
  return [
    ...new Set(
      checkNoInventedExperience(input, output, {
        jobDescription,
        applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
      }).map((violation) => violation.kind),
    ),
  ];
}

describe("checker allows harmless rewording", () => {
  it("accepts an unchanged resume", () => {
    expect(checkNoInventedExperience(studentResume, structuredClone(studentResume))).toEqual([]);
  });

  it("accepts reordered skills, expanded dates, degree abbreviations, and restated bullets", () => {
    expect(checkNoInventedExperience(studentResume, rewordedStudentResume())).toEqual([]);
  });

  it("accepts moving a real internship into the internships array", () => {
    const out = structuredClone(studentResume);
    out.internships = out.experience;
    out.experience = [];
    expect(checkNoInventedExperience(studentResume, out)).toEqual([]);
  });

  it("accepts a digit that restates a number already written as a word", () => {
    const out = structuredClone(careerChangerResume);
    out.experience[0].details = [
      "Made coffee drinks and worked the register during morning shifts",
      "Trained 2 new hires on opening tasks",
    ];
    out.experience[0].date = "March 2025 – August 2025";
    expect(checkNoInventedExperience(careerChangerResume, out)).toEqual([]);
  });

  it("accepts a sparse resume that only restates its real skills", () => {
    const out = structuredClone(sparseResume);
    out.personalInfo.summary = "Looking for a first role using HTML and CSS.";
    out.skills = { technical: ["CSS", "HTML"], additional: [] };
    expect(checkNoInventedExperience(sparseResume, out)).toEqual([]);
  });

  it("accepts a JavaScript skill written as JS", () => {
    const input = structuredClone(sparseResume);
    input.skills = { technical: ["JavaScript"], additional: [] };
    const out = structuredClone(input);
    out.skills = { technical: ["JS"], additional: [] };
    expect(checkNoInventedExperience(input, out)).toEqual([]);
  });

  it("does not treat the job description as evidence", () => {
    const out = structuredClone(studentResume);
    out.skills.technical = [...out.skills.technical, "Kubernetes"];
    const violations = checkNoInventedExperience(studentResume, out, { jobDescription: jdBackend });
    expect(violations.some((violation) => violation.kind === "skill" && /kubernetes/i.test(violation.value))).toBe(true);
  });

  it("accepts a cover letter that only names the role being applied for", () => {
    const letter = {
      jobInfo: { company: "Northwind Payments", position: "Senior Backend Engineer" },
      letterContent: {
        openingParagraph:
          "I am applying for the Senior Backend Engineer role at Northwind Payments and have attached my resume.",
        bodyParagraphs: [
          "I am a computer science student at State University and interned at City Library, where I wrote a Python script to sort summer reading signups and helped patrons locate materials in the catalog.",
        ],
        closingParagraph: "Thank you for your time. I would welcome a conversation about this role.",
      },
    };
    expect(
      checkNoInventedExperience(studentResume, letter, {
        applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
        jobDescription: jdBackend,
      }),
    ).toEqual([]);
  });

  it("accepts a summary that names the job being applied for and restates real skills", () => {
    const out = structuredClone(studentResume);
    out.personalInfo.summary =
      "Highly motivated computer science student with experience in Python scripting seeking a challenging backend engineering role at Northwind Payments. Eager to contribute to scalable and reliable payment systems.";
    expect(
      checkNoInventedExperience(studentResume, out, {
        applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
        jobDescription: jdBackend,
      }),
    ).toEqual([]);
  });

  it("still flags a summary that invents work without framing it as a job objective", () => {
    const out = structuredClone(studentResume);
    out.personalInfo.summary = "Designed distributed payment ledgers for card networks.";
    expect(
      checkNoInventedExperience(studentResume, out, {
        applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
      }).some((violation) => violation.kind === "accomplishment"),
    ).toBe(true);
  });

  it("still flags a summary that claims the target company as a past employer", () => {
    const out = structuredClone(studentResume);
    out.personalInfo.summary = "I worked at Northwind Payments building payment systems.";
    expect(
      checkNoInventedExperience(studentResume, out, {
        applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
      }).some((violation) => violation.kind === "employer" && violation.value === "Northwind Payments"),
    ).toBe(true);
  });

  it("accepts an email that does not add candidate facts", () => {
    const email =
      "Hi there, I am interested in the Senior Backend Engineer opening at Northwind Payments. My resume is attached. Could we set up a short call?";
    expect(
      checkNoInventedExperience(studentResume, email, {
        applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
      }),
    ).toEqual([]);
  });

  it("accepts a faithful parse of pasted resume text", () => {
    const text = resumeToPlainText(studentResume);
    expect(checkNoInventedExperience(text, studentResume)).toEqual([]);
  });
});

describe("checker flags invented experience", () => {
  it("flags a new employer, upgraded title, dates, metrics, skills, school, degree, and certification", () => {
    const out = structuredClone(studentResume);
    out.personalInfo.summary =
      "Senior backend engineer with 5 years of experience. Reduced latency by 40%. M.S. Computer Science, Stanford University. AWS Certified Solutions Architect.";
    out.experience.push({
      company: "Northwind Payments",
      title: "Senior Backend Engineer",
      location: "Remote",
      date: "Jan 2019 - Present",
      details: ["Designed Kubernetes services on AWS handling 10,000 requests per second"],
    });
    out.skills.technical.push("Kubernetes", "AWS");
    out.education.push({
      name: "Stanford University",
      degree: "M.S. Computer Science",
      field: "Computer Science",
      location: "Stanford, CA",
      startDate: null,
      endDate: "Jun 2020",
      details: [],
    });
    out.certifications = [{ name: "AWS Certified Solutions Architect", issuer: "Amazon", date: "Mar 2023" }];
    out.projects = [
      {
        name: "Realtime payments ledger",
        description: "Processed millions of transactions",
        technologies: ["Kafka"],
        details: [],
      },
    ];

    const found = kinds(studentResume, out, jdBackend);
    for (const kind of ["employer", "title", "date", "metric", "skill", "school", "degree", "certification", "accomplishment"] as const) {
      expect(found, kind).toContain(kind);
    }
  });

  it("flags dropping Intern and adding Senior on the only real job", () => {
    const out = structuredClone(studentResume);
    out.experience[0].title = "Senior Software Engineer";
    expect(kinds(studentResume, out)).toContain("title");
  });

  it("flags a school-year span copied onto the job", () => {
    const out = structuredClone(studentResume);
    out.experience[0].date = "Aug 2022 - May 2026";
    expect(kinds(studentResume, out)).toContain("date");
  });

  it("flags an MBA and a campaign metric the cafe job does not support", () => {
    const out = structuredClone(careerChangerResume);
    out.education[0].degree = "MBA";
    out.experience[0].details.push("Grew inbound pipeline 120% using HubSpot and Google Analytics");
    const found = kinds(careerChangerResume, out);
    expect(found).toContain("degree");
    expect(found).toContain("metric");
    expect(found).toContain("skill");
  });

  it("flags a first job invented on an almost empty resume", () => {
    const out = structuredClone(sparseResume);
    out.experience = [
      {
        company: "Harbor Apps",
        title: "Staff Frontend Engineer",
        location: "Remote",
        date: "Jan 2018 - Present",
        details: ["Shipped React and TypeScript interfaces to 2 million users and improved conversion 18%"],
      },
    ];
    out.skills.technical.push("React", "TypeScript", "Next.js");
    const found = kinds(sparseResume, out);
    expect(found).toEqual(expect.arrayContaining(["employer", "title", "date", "metric", "skill"]));
  });

  it("flags a cover letter that claims the target company's work history", () => {
    const letter = {
      jobInfo: { company: "Northwind Payments", position: "Senior Backend Engineer" },
      letterContent: {
        openingParagraph: "I am excited to apply.",
        bodyParagraphs: [
          "At Northwind Payments I worked for 5 years leading Kubernetes migrations and cut latency 40%. I hold an MBA from Stanford University and am AWS Certified Solutions Architect.",
        ],
        closingParagraph: "Thank you.",
      },
    };
    const found = kinds(studentResume, letter, jdBackend);
    expect(found).toEqual(expect.arrayContaining(["employer", "metric", "skill", "school", "degree", "certification"]));
  });

  it("flags an email that invents an employer and a metric", () => {
    const email = "I have spent 5 years building Kubernetes platforms at Google and improved uptime to 99.9%.";
    const found = kinds(studentResume, email);
    expect(found).toEqual(expect.arrayContaining(["employer", "metric", "skill"]));
  });

  it("flags employers added while parsing pasted text", () => {
    const text = resumeToPlainText(sparseResume);
    const parsed = structuredClone(sparseResume);
    parsed.experience = [
      {
        company: "Harbor Apps",
        title: "Staff Frontend Engineer",
        location: "Remote",
        date: "Jan 2018 - Present",
        details: ["Built React apps for 2 million users"],
      },
    ];
    const found = kinds(text, parsed);
    expect(found).toContain("employer");
    expect(found).toContain("skill");
  });
});
