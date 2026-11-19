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
  kind: "query" | "mutation" | "action";
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

const prepWriteParams: ParamSpec[] = [
  { name: "jobId", type: "string" },
  { name: "interviewerName", type: "string" },
  { name: "interviewerRole", type: "string" },
  { name: "interviewerEmail", type: "string" },
  { name: "interviewDate", type: "string" },
  { name: "meetingLink", type: "string" },
  { name: "phoneBackup", type: "string" },
  { name: "compensationTarget", type: "string" },
  { name: "resumeUsed", type: "string" },
  { name: "status", type: "string", description: "upcoming|ready|completed|archived" },
  { name: "elevatorPitch", type: "string" },
  { name: "roleSummary", type: "string" },
  { name: "flashcards", type: "json", description: "[{id,category,front,back,hint?,confidence?,starred?}]" },
  { name: "stories", type: "json", description: "[{id,title,tag,hook?,situation,action,outcome,takeaway}]" },
  { name: "requirementMatches", type: "json", description: "[{id,requirement,priority,yourProof,strength}]" },
  { name: "questionsToAsk", type: "json", description: "[{id,question,whyItMatters?,category?,asked?,answerNotes?}]" },
  { name: "trapsAndGuardrails", type: "json", description: "[{id,trap,howToHandle}]" },
  { name: "checklist", type: "json", description: "[{id,label,done}]" },
  { name: "callNotes", type: "string" },
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
    method: "POST", path: "/agent/resumes/generate", fn: internal.agent.fns.resumesGenerate, kind: "action",
    params: [
      { name: "personalInfo", type: "json", required: true, description: '{"firstName","lastName","email","phone"?,"citizenship"?,"location"?,"linkedin"?,"github"?,"portfolio"?,"summary"?}' },
      { name: "education", type: "json", description: "Array of {name,degree,field?,location?,startDate?,endDate,details?}" },
      { name: "experience", type: "json", description: "Array of {company,title,location?,date,details}" },
      { name: "projects", type: "json", description: "Array of {name,description,date?,technologies?,details?}" },
      { name: "skills", type: "json", description: '{"technical":[...],"additional"?:[...]}' },
      { name: "certifications", type: "json", description: "Array of {name,issuer?,date?,credentialId?}" },
      { name: "internships", type: "json", description: "Mar template only: Array of {company,title,location?,date,details?}" },
      { name: "coreCompetencies", type: "json", description: 'Joseph template only: ["Technical Support","Problem-Solving",...]' },
      { name: "earlyCareer", type: "json", description: "Joseph template only: Array of {title,company,location?,date}" },
      { name: "additionalInfo", type: "json", description: '{"languages"?:[...],"references"?}' },
      { name: "targetCompany", type: "string", description: "Included in the saved resume's name" },
      { name: "template", type: "string", description: 'Template id: "jake" (default), "joseph" or "mar"' },
      { name: "jobId", type: "string", description: "Saved job this resume targets: adds must-haves to the scorecard and gives --aiQuestions the posting" },
      { name: "aiQuestions", type: "boolean", description: "true asks the model for sharper questions (slower, rate-limited). Default: built-in questions. The submitted content is never rewritten" },
    ],
    description:
      "Generate a resume PDF (template: jake, joseph or mar) from the content YOU wrote and save it. Returns {id,name,fileUrl,questions,questionSource,scorecard,rule}: relay questions to your human, never invent the numbers yourself",
  },
  {
    method: "PATCH", path: "/agent/resumes", fn: internal.agent.fns.resumesRename, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "name", type: "string", required: true },
    ],
    description: "Rename a resume",
  },
  {
    method: "POST", path: "/agent/resumes/share", fn: internal.agent.fns.resumesShare, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "off", type: "boolean", description: "true makes the resume private again" },
    ],
    description: "Make a resume's PDF public at /r/<shareId> (or private with off)",
  },
  {
    method: "PATCH", path: "/agent/resumes/content", fn: internal.agent.fns.resumesUpdateContent, kind: "action",
    params: [
      { name: "id", type: "string", required: true },
      { name: "personalInfo", type: "json", description: "Only the sections you pass are changed; the rest carry over" },
      { name: "education", type: "json", description: "Array of {name,degree,field?,location?,startDate?,endDate,details?}" },
      { name: "experience", type: "json", description: "Array of {company,title,location?,date,details}" },
      { name: "projects", type: "json", description: "Array of {name,description,date?,technologies?,details?}" },
      { name: "skills", type: "json", description: '{"technical":[...],"additional"?:[...]}' },
      { name: "certifications", type: "json", description: "Array of {name,issuer?,date?,credentialId?}" },
      { name: "internships", type: "json", description: "Mar template only: Array of {company,title,location?,date,details?}" },
      { name: "coreCompetencies", type: "json", description: 'Joseph template only: ["Technical Support",...]' },
      { name: "earlyCareer", type: "json", description: "Joseph template only: Array of {title,company,location?,date}" },
      { name: "additionalInfo", type: "json", description: '{"languages"?:[...],"references"?}' },
      { name: "template", type: "string", description: 'Switch template: "jake", "joseph" or "mar"' },
      { name: "jobId", type: "string", description: "Saved job this resume targets: adds must-haves to the scorecard and gives --aiQuestions the posting" },
      { name: "aiQuestions", type: "boolean", description: "true asks the model for sharper questions (slower, rate-limited). Default: built-in questions. The submitted content is never rewritten" },
    ],
    description:
      "Update an existing resume's content in place and regenerate its PDF, keeping the same id, name, label and favorite flag. Returns the same questions/scorecard block as generate",
  },

  {
    method: "POST", path: "/agent/resumes/move", fn: internal.agent.fns.resumesMove, kind: "mutation",
    params: [
      { name: "folder", type: "string", required: true, description: "Target folder: id, or exact name (case-insensitive). An ambiguous or unknown name is an error. GET /agent/folders lists them" },
      { name: "resumeIds", type: "json", description: "Array of resume ids to move. Ids that aren't yours come back in skipped as not_found" },
      { name: "allExceptFavorites", type: "boolean", description: "true selects every resume that is NOT a favorite (isFavorite). Use instead of resumeIds" },
      { name: "dryRun", type: "boolean", description: "true returns what WOULD move without changing anything" },
      { name: "confirm", type: "boolean", description: "Must be true for allExceptFavorites to actually move; without it the bulk move is a dry run" },
    ],
    description:
      "File resumes into one of your folders. Only folderId changes: never content, never deletes; base and tailored resumes alike. Returns {dryRun,folder:{id,name},moved:[{id,name}],skipped:[{id,name?,reason}],alreadyInFolder:[{id,name}],counts:{moved,skipped,alreadyInFolder,total},hint?}. On a dry run, moved lists what would move",
  },
  {
    method: "GET", path: "/agent/resumes/questions", fn: internal.agent.fns.resumesQuestions, kind: "action",
    params: [
      { name: "id", type: "string", required: true },
      { name: "jobId", type: "string", description: "Saved job to target (defaults to the job a tailored resume came from)" },
      { name: "ai", type: "boolean", description: "true asks the model (slower, rate-limited); default is built-in questions" },
    ],
    description:
      "Questions about bullets that lack a number, BEFORE generating. Returns {resumeId,questions:[{id,section,index,bullet,question,example?}],questionSource,scorecard,answers,answersOn,rule}. Ask your human, then POST /agent/resumes/answers",
  },
  {
    method: "POST", path: "/agent/resumes/answers", fn: internal.agent.fns.resumesAnswer, kind: "action",
    params: [
      { name: "id", type: "string", required: true, description: "Resume the questions were asked about. A tailored resume's answers are saved on its base" },
      { name: "answers", type: "json", required: true, description: '[{"id":"<question id>","answer":"..."}] or [{"section":"experience|projects","index":0,"bullet":"...","answer":"..."}]' },
    ],
    description:
      "Save the human's answers as facts on the base resume (bulletAnswers). Every later generate/tailor reuses them. Only save what the human actually said",
  },
  {
    method: "POST", path: "/agent/resumes/tailor", fn: internal.agent.tailor.resumesTailor, kind: "action",
    params: [
      { name: "base", type: "string", required: true, description: "Resume to tailor from (usually the base resume); it is not modified" },
      { name: "jobId", type: "string", required: true, description: "Saved job (its company, title and description drive the tailoring)" },
      { name: "template", type: "string", description: "jake, joseph or mar (defaults to the account's default template, then the base resume's, then jake). A template above the plan is not an error: jake is used and the response carries a notice" },
      { name: "instructions", type: "string", description: "One-off instruction for this resume, e.g. 'lead with the data work'. Wording and emphasis only, never new facts" },
      { name: "preferences", type: "json", description: "Array of strings; replaces the account's saved resume preferences for this call (default: the saved ones, as in the app)" },
    ],
    description:
      "Server-side tailoring, same as the in-app tailor: rewrites the base resume for one saved job using the user's saved answers and resume preferences (no invented facts), renders a NEW resume PDF, records what changed and sets the job's resumeUsed. An already-tailored resume as base is resolved to the original base it came from. Returns {id,name,fileName,fileUrl,template,notice?,baseResumeId,requestedBase,resume,questions,scorecard,baseScorecard,changes,marks,mustHaves,pages,model,answersUsed,instructionsUsed,rule}; template is the one actually used, and notice is set when the requested template is above the plan so jake was used instead. Slow (up to a few minutes); costs one document",
  },
  // ---- folders ----
  { method: "GET", path: "/agent/folders", fn: internal.agent.fns.foldersList, kind: "query", params: [], description: "List document folders: [{id,name,resumeCount,coverLetterCount}] sorted by name" },

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
  {
    method: "POST", path: "/agent/coverletters/generate", fn: internal.agent.fns.coverLettersGenerate, kind: "action",
    params: [
      { name: "personalInfo", type: "json", required: true, description: '{"firstName","lastName","email","phone"?,"location"?}' },
      { name: "jobInfo", type: "json", required: true, description: '{"company","position","hiringManagerName"?,"companyAddress"?}' },
      { name: "letterContent", type: "json", required: true, description: '{"openingParagraph","bodyParagraphs":[...],"closingParagraph"}' },
    ],
    description: "Generate a cover letter PDF using the Jake template and save it to the user's documents",
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

  // ---- interview preps ----
  {
    method: "GET", path: "/agent/interviewpreps", fn: internal.agent.fns.interviewPrepsList, kind: "query",
    params: [{ name: "jobId", type: "string", description: "Only preps linked to this job" }],
    description: "List interview prep decks (summary: counts, no card bodies)",
  },
  {
    method: "GET", path: "/agent/interviewpreps/get", fn: internal.agent.fns.interviewPrepsGet, kind: "query",
    params: [{ name: "id", type: "string", required: true }],
    description: "Get one interview prep deck with all flashcards, stories, questions, traps and checklist",
  },
  {
    method: "POST", path: "/agent/interviewpreps", fn: internal.agent.fns.interviewPrepsAdd, kind: "mutation",
    params: [
      { name: "company", type: "string", required: true },
      { name: "role", type: "string", required: true },
      ...prepWriteParams,
    ],
    description: "Create an interview prep deck",
  },
  {
    method: "PATCH", path: "/agent/interviewpreps", fn: internal.agent.fns.interviewPrepsUpdate, kind: "mutation",
    params: [
      { name: "id", type: "string", required: true },
      { name: "company", type: "string" },
      { name: "role", type: "string" },
      ...prepWriteParams,
    ],
    description: "Update an interview prep deck. Array fields (flashcards, stories, ...) REPLACE the whole array: get, edit, send back",
  },
  {
    method: "DELETE", path: "/agent/interviewpreps", fn: internal.agent.fns.interviewPrepsRemove, kind: "mutation",
    params: [{ name: "id", type: "string", required: true }],
    description: "Delete an interview prep deck",
  },

  // ---- threads (read-only) ----
  { method: "GET", path: "/agent/threads", fn: internal.agent.fns.threadsList, kind: "query", params: [], description: "List AI chat threads" },
  {
    method: "GET", path: "/agent/threads/get", fn: internal.agent.fns.threadsGet, kind: "query",
    params: [{ name: "id", type: "string", required: true }],
    description: "Get a thread with its messages",
  },
];
