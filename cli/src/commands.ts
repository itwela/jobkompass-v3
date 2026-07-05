export type OptSpec = {
  flag: string;            // commander flag, e.g. "--id <id>"
  api: string;             // server param name
  type: "str" | "num" | "bool" | "json" | "date";
  required?: boolean;
  default?: string;        // commander-level default (pre-coercion)
  desc?: string;
};

export type CommandSpec = {
  /** "noun verb" — registrar nests under the noun. */
  name: string;
  desc: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  opts: OptSpec[];
  /** Destructive: refuse without --yes. */
  confirm?: boolean;
};

const jobWriteOpts: OptSpec[] = [
  { flag: "--compensation <c>", api: "compensation", type: "str" },
  { flag: "--keywords <json>", api: "keywords", type: "json", desc: '["kw1","kw2"]' },
  { flag: "--skills <json>", api: "skills", type: "json", desc: '["skill1"]' },
  { flag: "--description <text>", api: "description", type: "str" },
  { flag: "--applied <date>", api: "dateApplied", type: "str", desc: "Date applied (freeform)" },
  { flag: "--interviewed", api: "interviewed", type: "bool" },
  { flag: "--easy-apply <yn>", api: "easyApply", type: "str", desc: "Yes|No" },
  { flag: "--resume-used <name>", api: "resumeUsed", type: "str" },
  { flag: "--coverletter-used <name>", api: "coverLetterUsed", type: "str" },
  { flag: "--notes <text>", api: "notes", type: "str" },
];

const resourceWriteOpts: OptSpec[] = [
  { flag: "--description <text>", api: "description", type: "str" },
  { flag: "--notes <text>", api: "notes", type: "str" },
  { flag: "--tags <json>", api: "tags", type: "json", desc: '["tag1"]' },
  { flag: "--category <cat>", api: "category", type: "str" },
];

export const commands: CommandSpec[] = [
  // jobs
  { name: "jobs list", desc: "List jobs (newest updated first)", method: "GET", path: "/agent/jobs",
    opts: [{ flag: "--status <status>", api: "status", type: "str", desc: "Interested|Applied|Callback|Interviewing|Rejected|Offered" }] },
  { name: "jobs get", desc: "Get one job", method: "GET", path: "/agent/jobs/get",
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "jobs add", desc: "Add a job", method: "POST", path: "/agent/jobs",
    opts: [
      { flag: "--company <name>", api: "company", type: "str", required: true },
      { flag: "--title <title>", api: "title", type: "str", required: true },
      { flag: "--link <url>", api: "link", type: "str", required: true },
      { flag: "--status <status>", api: "status", type: "str", default: "Interested" },
      ...jobWriteOpts,
    ] },
  { name: "jobs update", desc: "Update a job", method: "PATCH", path: "/agent/jobs",
    opts: [
      { flag: "--id <id>", api: "id", type: "str", required: true },
      { flag: "--company <name>", api: "company", type: "str" },
      { flag: "--title <title>", api: "title", type: "str" },
      { flag: "--link <url>", api: "link", type: "str" },
      { flag: "--status <status>", api: "status", type: "str" },
      ...jobWriteOpts,
    ] },
  { name: "jobs delete", desc: "Delete a job", method: "DELETE", path: "/agent/jobs", confirm: true,
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },

  // resumes
  { name: "resumes list", desc: "List resumes (metadata)", method: "GET", path: "/agent/resumes", opts: [] },
  { name: "resumes get", desc: "Get a resume with content", method: "GET", path: "/agent/resumes/get",
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "resumes rename", desc: "Rename a resume", method: "PATCH", path: "/agent/resumes",
    opts: [
      { flag: "--id <id>", api: "id", type: "str", required: true },
      { flag: "--name <name>", api: "name", type: "str", required: true },
    ] },
  { name: "resumes duplicate", desc: "Duplicate a resume", method: "POST", path: "/agent/resumes/duplicate",
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "resumes delete", desc: "Delete a resume + stored file", method: "DELETE", path: "/agent/resumes", confirm: true,
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "resumes add", desc: "Generate a resume PDF (Jake template) and save it", method: "POST", path: "/agent/resumes/generate",
    opts: [
      { flag: "--personal-info <json>", api: "personalInfo", type: "json", required: true,
        desc: '{"firstName","lastName","email","citizenship"?,"location"?,"linkedin"?,"github"?,"portfolio"?,"summary"?}' },
      { flag: "--education <json>", api: "education", type: "json", desc: "[{name,degree,field?,location?,startDate?,endDate,details?}]" },
      { flag: "--experience <json>", api: "experience", type: "json", desc: "[{company,title,location?,date,details}]" },
      { flag: "--projects <json>", api: "projects", type: "json", desc: "[{name,description,date?,technologies?,details?}]" },
      { flag: "--skills <json>", api: "skills", type: "json", desc: '{"technical":[...],"additional"?:[...]}' },
      { flag: "--certifications <json>", api: "certifications", type: "json", desc: "[{name,issuer?,date?,credentialId?}]" },
      { flag: "--additional-info <json>", api: "additionalInfo", type: "json", desc: '{"languages"?:[...],"references"?}' },
      { flag: "--target-company <name>", api: "targetCompany", type: "str", desc: "Included in the saved resume's name" },
    ] },

  // coverletters
  { name: "coverletters list", desc: "List cover letters (metadata)", method: "GET", path: "/agent/coverletters", opts: [] },
  { name: "coverletters get", desc: "Get a cover letter with content", method: "GET", path: "/agent/coverletters/get",
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "coverletters duplicate", desc: "Duplicate a cover letter", method: "POST", path: "/agent/coverletters/duplicate",
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "coverletters delete", desc: "Delete a cover letter + stored file", method: "DELETE", path: "/agent/coverletters", confirm: true,
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
  { name: "coverletters add", desc: "Generate a cover letter PDF (Jake template) and save it", method: "POST", path: "/agent/coverletters/generate",
    opts: [
      { flag: "--personal-info <json>", api: "personalInfo", type: "json", required: true, desc: '{"firstName","lastName","email","phone"?,"location"?}' },
      { flag: "--job-info <json>", api: "jobInfo", type: "json", required: true, desc: '{"company","position","hiringManagerName"?,"companyAddress"?}' },
      { flag: "--letter-content <json>", api: "letterContent", type: "json", required: true, desc: '{"openingParagraph","bodyParagraphs":[...],"closingParagraph"}' },
    ] },

  // emailtemplates
  { name: "emailtemplates list", desc: "List email templates", method: "GET", path: "/agent/emailtemplates", opts: [] },
  { name: "emailtemplates add", desc: "Create an email template", method: "POST", path: "/agent/emailtemplates",
    opts: [
      { flag: "--name <name>", api: "name", type: "str", required: true },
      { flag: "--type <type>", api: "type", type: "str", required: true, desc: "e.g. followup, cold-outreach" },
      { flag: "--content <json>", api: "content", type: "json", required: true, desc: '{"template":"...","variables":["name"]}' },
    ] },
  { name: "emailtemplates update", desc: "Update an email template", method: "PATCH", path: "/agent/emailtemplates",
    opts: [
      { flag: "--id <id>", api: "id", type: "str", required: true },
      { flag: "--name <name>", api: "name", type: "str" },
      { flag: "--type <type>", api: "type", type: "str" },
      { flag: "--content <json>", api: "content", type: "json" },
    ] },
  { name: "emailtemplates delete", desc: "Delete an email template", method: "DELETE", path: "/agent/emailtemplates", confirm: true,
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },

  // resources
  { name: "resources list", desc: "List saved resources", method: "GET", path: "/agent/resources", opts: [] },
  { name: "resources add", desc: "Save a resource/link", method: "POST", path: "/agent/resources",
    opts: [
      { flag: "--title <title>", api: "title", type: "str", required: true },
      { flag: "--url <url>", api: "url", type: "str", required: true },
      { flag: "--type <type>", api: "type", type: "str", default: "resource" },
      ...resourceWriteOpts,
    ] },
  { name: "resources update", desc: "Update a resource", method: "PATCH", path: "/agent/resources",
    opts: [
      { flag: "--id <id>", api: "id", type: "str", required: true },
      { flag: "--title <title>", api: "title", type: "str" },
      { flag: "--url <url>", api: "url", type: "str" },
      { flag: "--type <type>", api: "type", type: "str" },
      ...resourceWriteOpts,
    ] },
  { name: "resources delete", desc: "Delete a resource", method: "DELETE", path: "/agent/resources", confirm: true,
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },

  // threads (read-only)
  { name: "threads list", desc: "List AI chat threads", method: "GET", path: "/agent/threads", opts: [] },
  { name: "threads get", desc: "Get a thread with messages", method: "GET", path: "/agent/threads/get",
    opts: [{ flag: "--id <id>", api: "id", type: "str", required: true }] },
];
