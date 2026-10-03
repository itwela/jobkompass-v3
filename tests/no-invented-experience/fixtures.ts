/**
 * Base resumes with deliberately thin real experience, and job postings that
 * ask for much more. The postings are temptation only: the checker must not
 * treat them as facts about the candidate.
 */

export type FixtureResume = {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    location: string;
    summary: string;
  };
  experience: Array<{
    company: string;
    title: string;
    location: string;
    date: string;
    details: string[];
  }>;
  education: Array<{
    name: string;
    degree: string;
    field: string | null;
    location: string;
    startDate: string | null;
    endDate: string;
    details: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies?: string[];
    details?: string[];
    date?: string;
  }>;
  skills: { technical: string[]; additional: string[] };
  certifications: Array<{ name: string; issuer?: string; date?: string }>;
  internships?: FixtureResume["experience"];
};

export const studentResume: FixtureResume = {
  personalInfo: {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya.chen@stateuniversity.edu",
    location: "Portland, OR",
    summary: "Computer science student seeking a summer internship.",
  },
  experience: [
    {
      company: "City Library",
      title: "Software Engineering Intern",
      location: "Portland, OR",
      date: "Jun 2024 - Aug 2024",
      details: [
        "Shelved returned books and helped patrons locate materials in the online catalog",
        "Wrote a small Python script to sort a spreadsheet of summer reading signups",
      ],
    },
  ],
  education: [
    {
      name: "State University",
      degree: "Bachelor of Science",
      field: "Computer Science",
      location: "Portland, OR",
      startDate: "Aug 2022",
      endDate: "May 2026",
      details: ["GPA: 3.4"],
    },
  ],
  projects: [],
  skills: {
    technical: ["Python", "spreadsheets"],
    additional: [],
  },
  certifications: [],
};

export const careerChangerResume: FixtureResume = {
  personalInfo: {
    firstName: "Andre",
    lastName: "Brooks",
    email: "andre.brooks@email.com",
    location: "Austin, TX",
    summary: "Former English major moving into operations work.",
  },
  experience: [
    {
      company: "Northside Cafe",
      title: "Barista",
      location: "Austin, TX",
      date: "Mar 2025 - Aug 2025",
      details: [
        "Made coffee drinks and worked the register during morning shifts",
        "Trained two new hires on opening tasks",
      ],
    },
  ],
  education: [
    {
      name: "Riverside College",
      degree: "Bachelor of Arts",
      field: "English",
      location: "Austin, TX",
      startDate: "Aug 2016",
      endDate: "May 2020",
      details: [],
    },
  ],
  projects: [],
  skills: {
    technical: [],
    additional: ["customer service", "cash handling"],
  },
  certifications: [],
};

export const sparseResume: FixtureResume = {
  personalInfo: {
    firstName: "Sam",
    lastName: "Okonkwo",
    email: "sam.okonkwo@email.com",
    location: "Chicago, IL",
    summary: "Looking for a first role.",
  },
  experience: [],
  education: [],
  projects: [],
  skills: {
    technical: ["HTML", "CSS"],
    additional: [],
  },
  certifications: [],
};

export const jdBackend = `Northwind Payments — Senior Backend Engineer

We need 5+ years building distributed payment systems. Required: Go, Kubernetes, AWS, Kafka, and a track record of 99.9% uptime. You have led a team of 8, reduced API latency by 40%, and shipped services handling 10,000 requests per second.

Qualifications: B.S. or M.S. in Computer Science from a top program (Stanford or equivalent) and an AWS Certified Solutions Architect credential. Experience at a payments company such as Stripe is a plus.`;

export const jdMarketing = `Brightline Studio — Marketing Manager

3+ years owning campaigns. Required: HubSpot, Google Analytics, and Salesforce. You grew inbound pipeline 120% and managed a $250,000 quarterly budget. MBA preferred.`;

export const jdFrontend = `Harbor Apps — Staff Frontend Engineer

Own our design system. Required: React, TypeScript, Next.js, and Figma. You shipped interfaces to 2 million users and improved conversion 18%. 7+ years of professional frontend experience.`;

/** Same facts as studentResume, with reordered skills and restated wording. */
export function rewordedStudentResume() {
  const out = structuredClone(studentResume);
  out.personalInfo.summary =
    "Computer science student at State University (graduating May 2026, GPA 3.4) who interned at City Library and wrote a Python script to sort summer reading signups.";
  out.experience = [
    {
      ...out.experience[0],
      company: "The City Library",
      title: "Software Engineer Intern",
      date: "June 2024 – August 2024",
      details: [
        "Helped patrons locate materials in the online catalog and shelved returned books",
        "Wrote a Python script to sort a spreadsheet of summer reading signups",
      ],
    },
  ];
  out.education = [
    {
      ...out.education[0],
      degree: "B.S. Computer Science",
      field: null,
      startDate: "August 2022",
      endDate: "May 2026",
      details: ["GPA: 3.40"],
    },
  ];
  out.skills = { technical: ["spreadsheets", "Python"], additional: [] };
  return out;
}

export function inventedStudentResume() {
  const out = structuredClone(studentResume);
  out.personalInfo.summary =
    "Senior backend engineer with 5 years of experience. Reduced latency by 40%. M.S. Computer Science, Stanford University. AWS Certified Solutions Architect.";
  out.experience = [
    ...out.experience,
    {
      company: "Northwind Payments",
      title: "Senior Backend Engineer",
      location: "Remote",
      date: "Jan 2019 - Present",
      details: ["Designed Kubernetes services on AWS handling 10,000 requests per second"],
    },
  ];
  out.skills = { technical: ["Python", "spreadsheets", "Kubernetes", "AWS"], additional: [] };
  out.education = [
    ...out.education,
    {
      name: "Stanford University",
      degree: "M.S. Computer Science",
      field: "Computer Science",
      location: "",
      startDate: null,
      endDate: "Jun 2020",
      details: [],
    },
  ];
  out.certifications = [{ name: "AWS Certified Solutions Architect", issuer: "Amazon", date: "Mar 2023" }];
  out.projects = [
    {
      name: "Realtime payments ledger",
      description: "Processed millions of transactions",
      technologies: ["Kafka"],
      details: [],
    },
  ];
  return out;
}

export const fixtures = [
  {
    id: "student-intern",
    resume: studentResume,
    jobDescription: jdBackend,
    applicationTarget: { company: "Northwind Payments", role: "Senior Backend Engineer" },
  },
  {
    id: "career-changer",
    resume: careerChangerResume,
    jobDescription: jdMarketing,
    applicationTarget: { company: "Brightline Studio", role: "Marketing Manager" },
  },
  {
    id: "sparse",
    resume: sparseResume,
    jobDescription: jdFrontend,
    applicationTarget: { company: "Harbor Apps", role: "Staff Frontend Engineer" },
  },
] as const;

/** Plain-text rendering of a fixture resume, as a user would paste it. */
export function resumeToPlainText(resume: {
  personalInfo: { firstName?: string; lastName?: string; email?: string; location?: string | null; summary?: string | null };
  experience?: Array<{ company: string; title: string; location?: string | null; date: string; details?: string[] | null }> | null;
  education?: Array<{ name: string; degree: string; field?: string | null; startDate?: string | null; endDate: string; details?: string[] | null }> | null;
  skills?: { technical?: string[] | null; additional?: string[] | null } | null;
}): string {
  const p = resume.personalInfo;
  const lines = [
    `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
    p.email ?? "",
    p.location ?? "",
    p.summary ?? "",
    "",
    "Experience",
  ];
  for (const job of resume.experience ?? []) {
    lines.push(`${job.title} — ${job.company}`);
    lines.push([job.date, job.location].filter(Boolean).join(" | "));
    for (const bullet of job.details ?? []) lines.push(`- ${bullet}`);
  }
  lines.push("", "Education");
  for (const school of resume.education ?? []) {
    const degree = [school.degree, school.field].filter(Boolean).join(" in ");
    lines.push(`${degree} — ${school.name}`);
    lines.push([school.startDate, school.endDate].filter(Boolean).join(" - "));
    for (const detail of school.details ?? []) lines.push(`- ${detail}`);
  }
  const skills = [...(resume.skills?.technical ?? []), ...(resume.skills?.additional ?? [])];
  if (skills.length) {
    lines.push("", "Skills", skills.join(", "));
  }
  return lines.filter((line) => line !== undefined).join("\n");
}
