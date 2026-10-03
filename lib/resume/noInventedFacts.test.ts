import { describe, expect, it } from "vitest";
import { checkNoInventedExperience } from "../../tests/no-invented-experience/checker";
import {
  claimFreeLetter,
  EMPTY_CANDIDATE,
  resumeContextFromMessage,
  resumeJsonFromText,
  scrubAssistantMessage,
  scrubInventedExperience,
} from "./noInventedFacts";

const pet = {
  personalInfo: {
    firstName: "Riley",
    lastName: "Okada",
    email: "riley.okada@example.com",
    location: "Spokane, WA",
    summary: "Looking for part-time work while taking classes.",
  },
  experience: [
    {
      company: "Maple Street Pets",
      title: "Pet Care Assistant",
      location: "Spokane, WA",
      date: "Sep 2023 - Jan 2024",
      details: ["Walked neighborhood dogs on weekday afternoons", "Texted owners a short note after each walk"],
    },
  ],
  education: [
    {
      name: "Spokane Falls Community College",
      degree: "Associate of Arts",
      field: "General Studies",
      location: "Spokane, WA",
      startDate: "Sep 2021",
      endDate: "Jun 2023",
      details: [],
    },
  ],
  skills: { technical: [] as string[], additional: ["scheduling", "texting"] },
  certifications: [] as Array<{ name: string; issuer?: string; date?: string }>,
};

const target = { company: "Helios Cloud", role: "Staff Site Reliability Engineer" };
const options = { applicationTarget: target };

describe("scrubInventedExperience", () => {
  it("keeps a resume that only restates the source", () => {
    const kept = scrubInventedExperience(pet, structuredClone(pet), options);
    expect(checkNoInventedExperience(pet, kept, options)).toEqual([]);
    expect(JSON.stringify(kept)).toContain("Maple Street Pets");
    expect(JSON.stringify(kept)).toContain("Spokane Falls Community College");
  });

  it("strips an invented employer, school, certification, tool, and metric", () => {
    const invented = structuredClone(pet);
    invented.experience.unshift({
      company: "Google",
      title: "Staff Site Reliability Engineer",
      location: "Mountain View, CA",
      date: "Jan 2016 - Jan 2024",
      details: ["Cut MTTR by 60% with Kubernetes for a team of 12"],
    });
    invented.education.push({
      name: "Stanford University",
      degree: "M.S.",
      field: "Computer Science",
      location: "Stanford, CA",
      startDate: "Sep 2014",
      endDate: "Jun 2016",
      details: [],
    });
    invented.certifications.push({ name: "CKAD", issuer: "Linux Foundation", date: "2022" });
    invented.skills.technical.push("Kubernetes", "Terraform", "Go");
    const kept = scrubInventedExperience(pet, invented, options);
    expect(checkNoInventedExperience(pet, kept, options)).toEqual([]);
    const text = JSON.stringify(kept);
    expect(text).not.toMatch(/Google|Stanford|CKAD|Kubernetes|Terraform|60%/);
    expect(text).toContain("Maple Street Pets");
  });

  it("replaces a cover letter full of invented claims with a claim-free letter", () => {
    const letter = {
      personalInfo: { firstName: "Riley", lastName: "Okada", email: "riley.okada@example.com" },
      jobInfo: { company: "Helios Cloud", position: "Staff Site Reliability Engineer" },
      letterContent: {
        openingParagraph: "I worked at Google for eight years running Kubernetes.",
        bodyParagraphs: ["I earned an M.S. from Stanford University and I hold a CKAD. I cut MTTR by 60%."],
        closingParagraph: "Thank you for your time.",
      },
    };
    const kept = scrubInventedExperience(pet, letter, options);
    expect(checkNoInventedExperience(pet, kept, options)).toEqual([]);
    expect(JSON.stringify(kept)).not.toMatch(/Google|Stanford|CKAD|Kubernetes|60%/);
    expect(JSON.stringify(kept)).toContain("Helios Cloud");
  });

  it("makes no experience claims when the source resume is empty", () => {
    const letter = claimFreeLetter(options);
    expect(checkNoInventedExperience(EMPTY_CANDIDATE, letter, options)).toEqual([]);
    const invented = "I worked at Google and cut MTTR by 60% with Kubernetes.";
    const kept = scrubInventedExperience(EMPTY_CANDIDATE, invented, options);
    expect(kept).toBe("");
    expect(checkNoInventedExperience(EMPTY_CANDIDATE, "I am writing to apply for the Staff Site Reliability Engineer role at Helios Cloud.", options)).toEqual([]);
  });
});

describe("scrubAssistantMessage", () => {
  it("drops an updates entry and a sentence that invent facts", () => {
    const message = `I added your Google Kubernetes work and a 60% MTTR cut.
\`\`\`updates
[
  { "type": "experience_bullet", "experienceId": "exp1", "value": "Cut MTTR by 60% with Kubernetes at Google" },
  { "type": "experience_bullet", "experienceId": "exp1", "value": "Texted owners a short note after each walk" }
]
\`\`\``;
    const kept = scrubAssistantMessage(pet, message, options);
    expect(kept).toContain("Texted owners");
    expect(kept).not.toMatch(/Google|Kubernetes|60%/);
    const match = kept.match(/```updates\s*([\s\S]*?)```/i);
    expect(match).toBeTruthy();
    const updates = JSON.parse(match![1]) as Array<{ value: string }>;
    expect(updates).toHaveLength(1);
    expect(checkNoInventedExperience(pet, updates[0].value, options)).toEqual([]);
  });

  it("drops a short sentence that claims an employer", () => {
    expect(scrubAssistantMessage(pet, "I worked at Google.", options)).toBe("");
  });
});

describe("resume context parsing", () => {
  it("stops before the job posting instruction", () => {
    const message = "Resume context:\nRiley Okada\nPet Care Assistant at Maple Street Pets\n\nRewrite this resume and add Kubernetes from the job posting.";
    expect(resumeContextFromMessage(message)).not.toMatch(/Kubernetes|job posting/i);
    expect(resumeContextFromMessage(message)).toContain("Maple Street Pets");
  });

  it("reads a resume object pasted after Resume:", () => {
    const text = `Draft JSON.\n\nResume:\n${JSON.stringify(pet)}\n\nReturn ONLY JSON.`;
    expect(resumeJsonFromText(text)).toMatchObject({ personalInfo: { firstName: "Riley" } });
  });
});
