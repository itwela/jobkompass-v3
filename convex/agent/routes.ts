import { internal } from "../_generated/api";

export type ParamType = "string" | "number" | "boolean" | "json";

export type ParamSpec = {
  name: string;
  type: ParamType;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  description?: string;
};

export type AgentRoute = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: any; // internal.agent.fns.* reference; every fn takes an injected userId
  kind: "query" | "mutation";
  params: ParamSpec[];
  description: string;
};

const jobWriteParams: ParamSpec[] = [
  { name: "compensation", type: "string" },
  { name: "keywords", type: "json", description: "Array of strings" },
  { name: "skills", type: "json", description: "Array of strings" },
  { name: "description", type: "string" },
  { name: "dateApplied", type: "string" },
  { name: "interviewed", type: "boolean" },
  { name: "easyApply", type: "string", description: "Yes|No" },
  { name: "resumeUsed", type: "string" },
  { name: "coverLetterUsed", type: "string" },
  { name: "notes", type: "string" },
];

export const agentRoutes: AgentRoute[] = [
  // ---- jobs ----
  {
    method: "GET", path: "/agent/jobs", fn: internal.agent.fns.jobsList, kind: "query",
    params: [{ name: "status", type: "string", description: "Filter, e.g. Applied, Interested" }],
    description: "List jobs (most recently updated first)",
  },
  {
    method: "GET", path: "/agent/jobs/get", fn: internal.agent.fns.jobsGet, kind: "query",
    params: [{ name: "id", type: "string", required: true }],
    description: "Get one job",
  },
  {
    method: "POST", path: "/agent/jobs", fn: internal.agent.fns.jobsAdd, kind: "mutation",
    params: [
      { name: "company", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "link", type: "string", required: true },
      { name: "status", type: "string", required: true, description: "Interested|Applied|Callback|Interviewing|Rejected|Offered" },
      ...jobWriteParams,
    ],
    description: "Add a job",
  },
  {
    method: "PATCH", path: "/agent/jobs", fn: internal.agent.fns.jobsUpdate, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "company", type: "string" },
      { name: "title", type: "string" },
      { name: "link", type: "string" },
      { name: "status", type: "string" },
      ...jobWriteParams,
    ],
    description: "Update a job",
  },
  {
    method: "DELETE", path: "/agent/jobs", fn: internal.agent.fns.jobsRemove, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Delete a job",
  },

  // ---- resumes ----
  { method: "GET", path: "/agent/resumes", fn: internal.agent.fns.resumesList, kind: "query", params: [], description: "List resumes (metadata only)" },
  {
    method: "GET", path: "/agent/resumes/get", fn: internal.agent.fns.resumesGet, kind: "query",
    params: [{ name: "id", type: "string", required: true }],
    description: "Get one resume with content",
  },
  {
    method: "DELETE", path: "/agent/resumes", fn: internal.agent.fns.resumesDelete, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Delete a resume (and its stored file)",
  },
  {
    method: "POST", path: "/agent/resumes/duplicate", fn: internal.agent.fns.resumesDuplicate, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Duplicate a resume",
  },
  {
    method: "PATCH", path: "/agent/resumes", fn: internal.agent.fns.resumesRename, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "name", type: "string", required: true },
    ],
    description: "Rename a resume",
  },

  // ---- cover letters ----
  { method: "GET", path: "/agent/coverletters", fn: internal.agent.fns.coverLettersList, kind: "query", params: [], description: "List cover letters (metadata only)" },
  {
    method: "GET", path: "/agent/coverletters/get", fn: internal.agent.fns.coverLettersGet, kind: "query",
    params: [{ name: "id", type: "string", required: true }],
    description: "Get one cover letter with content",
  },
  {
    method: "DELETE", path: "/agent/coverletters", fn: internal.agent.fns.coverLettersDelete, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Delete a cover letter (and its stored file)",
  },
  {
    method: "POST", path: "/agent/coverletters/duplicate", fn: internal.agent.fns.coverLettersDuplicate, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Duplicate a cover letter",
  },

  // ---- email templates ----
  { method: "GET", path: "/agent/emailtemplates", fn: internal.agent.fns.emailTemplatesList, kind: "query", params: [], description: "List email templates" },
  {
    method: "POST", path: "/agent/emailtemplates", fn: internal.agent.fns.emailTemplatesSave, kind: "mutation",
    params: [
      { name: "name", type: "string", required: true },
      { name: "type", type: "string", required: true },
      { name: "content", type: "json", required: true, description: '{"template": "...", "variables": ["..."], "defaultValues"?: {...}}' },
    ],
    description: "Create an email template",
  },
  {
    method: "PATCH", path: "/agent/emailtemplates", fn: internal.agent.fns.emailTemplatesUpdate, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "name", type: "string" },
      { name: "type", type: "string" },
      { name: "content", type: "json" },
    ],
    description: "Update an email template",
  },
  {
    method: "DELETE", path: "/agent/emailtemplates", fn: internal.agent.fns.emailTemplatesDelete, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Delete an email template",
  },

  // ---- resources ----
  { method: "GET", path: "/agent/resources", fn: internal.agent.fns.resourcesList, kind: "query", params: [], description: "List saved resources" },
  {
    method: "POST", path: "/agent/resources", fn: internal.agent.fns.resourcesAdd, kind: "mutation",
    params: [
      { name: "title", type: "string", required: true },
      { name: "url", type: "string", required: true },
      { name: "type", type: "string", default: "resource" },
      { name: "description", type: "string" },
      { name: "notes", type: "string" },
      { name: "tags", type: "json", description: "Array of strings" },
      { name: "category", type: "string" },
    ],
    description: "Save a resource/link",
  },
  {
    method: "PATCH", path: "/agent/resources", fn: internal.agent.fns.resourcesUpdate, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "title", type: "string" },
      { name: "url", type: "string" },
      { name: "type", type: "string" },
      { name: "description", type: "string" },
      { name: "notes", type: "string" },
      { name: "tags", type: "json" },
      { name: "category", type: "string" },
    ],
    description: "Update a resource",
  },
  {
    method: "DELETE", path: "/agent/resources", fn: internal.agent.fns.resourcesRemove, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Delete a resource",
  },

  // ---- threads (read-only) ----
  { method: "GET", path: "/agent/threads", fn: internal.agent.fns.threadsList, kind: "query", params: [], description: "List AI chat threads" },
  {
    method: "GET", path: "/agent/threads/get", fn: internal.agent.fns.threadsGet, kind: "query",
    params: [{ name: "id", type: "string", required: true }],
    description: "Get a thread with its messages",
  },
];
