/**
 * Deterministic check: generated resume text must not add employers, titles,
 * dates, metrics, skills/tools, schools, degrees, certifications, or
 * accomplishment claims that the source resume does not support.
 *
 * Rewording and reordering of real content is allowed. A job description passed
 * in options is never added to the allowlist.
 */

export type ViolationKind =
  | "employer"
  | "title"
  | "date"
  | "metric"
  | "skill"
  | "school"
  | "degree"
  | "certification"
  | "accomplishment";

export interface Violation {
  kind: ViolationKind;
  value: string;
  where: string;
}

export interface CheckOptions {
  /** Ignored on purpose. Job text must never become candidate facts. */
  jobDescription?: string;
  /** Company and role the candidate is applying to, not a past employer. */
  applicationTarget?: { company?: string; role?: string };
}

type NumTok = { value: number; percent: boolean; money: boolean };

type DateFacts = { pairs: Set<string>; years: Set<string>; open: boolean };

type Allow = {
  textSource: boolean;
  corpus: string;
  corpusNorm: string;
  tokens: Set<string>;
  orgs: string[];
  schools: string[];
  titles: string[];
  skillCanons: Set<string>;
  degreeLevels: Set<string>;
  educationBlob: string;
  certs: string[];
  projectNames: string[];
  numbers: NumTok[];
  experienceDates: DateFacts;
  educationDates: DateFacts;
  allDates: DateFacts;
};

const MONTHS: Record<string, string> = {
  jan: "jan",
  january: "jan",
  feb: "feb",
  february: "feb",
  mar: "mar",
  march: "mar",
  apr: "apr",
  april: "apr",
  may: "may",
  jun: "jun",
  june: "jun",
  jul: "jul",
  july: "jul",
  aug: "aug",
  august: "aug",
  sep: "sep",
  sept: "sep",
  september: "sep",
  oct: "oct",
  october: "oct",
  nov: "nov",
  november: "nov",
  dec: "dec",
  december: "dec",
};

const MONTH_ALT =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const FILLER = new Set(["the", "of", "and", "at", "for", "a", "an"]);

const STOP = new Set(
  `a an the and or of to for in on with from by at as into over during their them they that this these those was were been be is are it its per across within new small other also both while after before through using via than then about more most very highly quickly effectively successfully various multiple daily weekly our my your his her i we you not no nor so if but can may will just only such including include onto upon up out off each any all some many much`.split(
    /\s+/,
  ),
);

const VERBS = new Set(
  `led lead leading managed manage managing helped help helping worked work working assisted assist assisting supported support supporting developed develop developing built build building created create creating used use using wrote write writing made make making trained train training responsible did do doing served serve serving handled handle handling provided provide providing maintained maintain maintaining organized organize organizing sorted sort sorting seeking looking moving`.split(
    /\s+/,
  ),
);

const SKILL_FILLERS = new Set([
  "programming",
  "development",
  "skills",
  "tools",
  "software",
  "basic",
  "fundamentals",
  "language",
  "languages",
  "framework",
  "frameworks",
  "tool",
]);

const ALIAS_GROUPS: string[][] = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["python", "py"],
  ["nodejs", "node", "node.js", "node js"],
  ["react", "react.js", "reactjs", "react js"],
  ["nextjs", "next.js", "next js"],
  ["kubernetes", "k8s"],
  ["golang", "go"],
  ["gcp", "google cloud"],
  ["aws", "amazon web services"],
  ["postgresql", "postgres"],
  ["csharp", "c#", "c sharp"],
  ["dotnet", ".net"],
  ["html", "html5"],
  ["css", "css3"],
];

const LEXICON = [
  "kubernetes",
  "k8s",
  "docker",
  "aws",
  "gcp",
  "azure",
  "terraform",
  "kafka",
  "react",
  "react.js",
  "next.js",
  "nextjs",
  "typescript",
  "javascript",
  "node.js",
  "nodejs",
  "python",
  "java",
  "golang",
  "postgres",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "graphql",
  "pytorch",
  "tensorflow",
  "figma",
  "jira",
  "salesforce",
  "hubspot",
  "tableau",
  "excel",
  "google analytics",
  "looker",
  "snowflake",
  "airflow",
  "jenkins",
  "html",
  "css",
  "sql",
  "microservices",
  "grpc",
  "elasticsearch",
  "dynamodb",
  "ansible",
  "linux",
  "webpack",
  "vue",
  "angular",
  "svelte",
  "django",
  "flask",
  "fastapi",
  "rails",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "rust",
  "c#",
  ".net",
  "spring",
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
  million: 1000000,
  millions: 1000000,
};

const ELITE_SCHOOLS = ["stanford", "harvard", "mit", "carnegie mellon", "oxford", "cambridge"];

const EMPLOYMENT_CUE =
  /\b(worked|working|interned|employed|employment|my time|while at|joined|experience at|i was a|i served as)\b/i;

const TITLE_PHRASE =
  /\b(senior|staff|principal|lead|director|head|chief)\s+(?:\w+\s+){0,3}(engineer|developer|manager|designer|analyst|scientist|consultant|architect)\b/i;

const DEGREE_WORD =
  /\b(ph\.?d\.?|doctorate|mba|m\.?\s?s\.?|m\.?\s?sc|master(?:'s)?|b\.?\s?s\.?|b\.?\s?sc|b\.?\s?a\.?|bachelor(?:'s)?|associate(?:'s)?)\b/i;

const CERT_RE =
  /\b((?:aws|google|microsoft|cisco|oracle)\s+certified[\w\s-]{0,40}|certified\s+(?:solutions architect|developer|administrator|scrum master|public accountant)|pmp\b|cissp\b|comptia\s+[\w+]+)/gi;

const SCHOOL_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:University|College)|University of\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;

export function checkNoInventedExperience(
  input: unknown,
  output: unknown,
  options: CheckOptions = {},
): Violation[] {
  // options.jobDescription is accepted so callers can pass the posting.
  // It is intentionally unread.
  void options.jobDescription;

  const allow = buildAllow(input);
  const violations: Violation[] = [];

  if (isCoverLetter(output)) {
    const target = {
      company: options.applicationTarget?.company ?? output.jobInfo?.company,
      role: options.applicationTarget?.role ?? output.jobInfo?.position,
    };
    const prose = [
      output.letterContent?.openingParagraph,
      ...(output.letterContent?.bodyParagraphs ?? []),
      output.letterContent?.closingParagraph,
    ]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n");
    violations.push(...checkProse(prose, allow, target, "letter"));
  } else if (isResume(output)) {
    violations.push(...checkResume(output, allow, options.applicationTarget));
  } else if (typeof output === "string") {
    violations.push(...checkProse(output, allow, options.applicationTarget, "text"));
  }

  return dedupe(violations);
}

function checkResume(
  resume: ResumeShape,
  allow: Allow,
  target: CheckOptions["applicationTarget"],
): Violation[] {
  const out: Violation[] = [];
  const jobs = [
    ...(resume.experience ?? []).map((job, i) => ({ job, where: `experience[${i}]` })),
    ...(resume.internships ?? []).map((job, i) => ({ job, where: `internships[${i}]` })),
    ...(resume.earlyCareer ?? []).map((job, i) => ({ job, where: `earlyCareer[${i}]` })),
  ];

  for (const { job, where } of jobs) {
    if (job.company && !employerSupported(job.company, allow)) {
      out.push({ kind: "employer", value: job.company, where: `${where}.company` });
    }
    if (job.title && !titleOk(job.title, allow)) {
      out.push({ kind: "title", value: job.title, where: `${where}.title` });
    }
    if (job.date && !dateFieldOk(job.date, allow.experienceDates)) {
      out.push({ kind: "date", value: job.date, where: `${where}.date` });
    }
    for (const [b, bullet] of (job.details ?? []).entries()) {
      out.push(...checkFreeText(bullet, allow, `${where}.details[${b}]`, true));
    }
  }

  for (const [i, school] of (resume.education ?? []).entries()) {
    if (school.name && !schoolOk(school.name, allow)) {
      out.push({ kind: "school", value: school.name, where: `education[${i}].name` });
    }
    const degreeBits = [school.degree, school.field].filter(Boolean).join(" ");
    if (degreeBits && !degreeOk(degreeBits, allow)) {
      out.push({ kind: "degree", value: degreeBits, where: `education[${i}].degree` });
    }
    const dateBits = [school.startDate, school.endDate].filter(Boolean).join(" - ");
    if (dateBits && !dateFieldOk(dateBits, allow.educationDates)) {
      out.push({ kind: "date", value: dateBits, where: `education[${i}].date` });
    }
    for (const detail of school.details ?? []) {
      out.push(...checkFreeText(detail, allow, `education[${i}].details`, false));
    }
  }

  for (const [i, project] of (resume.projects ?? []).entries()) {
    if (project.name && !projectOk(project.name, allow)) {
      out.push({ kind: "accomplishment", value: project.name, where: `projects[${i}].name` });
    }
    if (project.date && !dateFieldOk(project.date, allow.allDates)) {
      out.push({ kind: "date", value: project.date, where: `projects[${i}].date` });
    }
    for (const tech of project.technologies ?? []) {
      if (!skillOk(tech, allow)) out.push({ kind: "skill", value: tech, where: `projects[${i}].technologies` });
    }
    const blob = [project.description, ...(project.details ?? [])].filter(Boolean).join(" ");
    if (blob) out.push(...checkFreeText(blob, allow, `projects[${i}].description`, true));
  }

  for (const skill of allSkillPhrases(resume)) {
    if (!skillOk(skill, allow)) out.push({ kind: "skill", value: skill, where: "skills" });
  }

  for (const [i, cert] of (resume.certifications ?? []).entries()) {
    if (cert.name && !certOk(cert.name, allow)) {
      out.push({ kind: "certification", value: cert.name, where: `certifications[${i}].name` });
    }
    if (cert.issuer && !phraseIn(cert.issuer, allow.corpus) && !certOk(cert.issuer, allow)) {
      out.push({ kind: "certification", value: cert.issuer, where: `certifications[${i}].issuer` });
    }
  }

  const summary = resume.personalInfo?.summary;
  if (summary) out.push(...checkFreeText(summary, allow, "personalInfo.summary", true));

  if (target) {
    // A summary may name the role being applied for. Concrete new facts still flag above.
    void target;
  }

  return out;
}

function checkFreeText(text: string, allow: Allow, where: string, accomplishments: boolean): Violation[] {
  const out: Violation[] = [];
  out.push(...unsupportedMetrics(text, allow, where));
  out.push(...unsupportedDatesInText(text, allow, where));
  for (const skill of lexiconHits(text)) {
    if (!skillOk(skill, allow)) out.push({ kind: "skill", value: skill, where });
  }
  for (const degree of degreeHits(text)) {
    if (!degreeOk(degree, allow)) out.push({ kind: "degree", value: degree, where });
  }
  for (const cert of certHits(text)) {
    if (!certOk(cert, allow)) out.push({ kind: "certification", value: cert, where });
  }
  for (const school of schoolHits(text)) {
    if (!schoolOk(school, allow)) out.push({ kind: "school", value: school, where });
  }
  const titleMatch = text.match(TITLE_PHRASE);
  if (titleMatch && !titleOk(titleMatch[0], allow)) {
    out.push({ kind: "title", value: titleMatch[0], where });
  }
  for (const org of orgHits(text)) {
    if (!employerSupported(org, allow) && !schoolOk(org, allow) && !phraseIn(org, allow.corpus)) {
      out.push({ kind: "employer", value: org, where });
    }
  }
  if (accomplishments) {
    const novel = novelContentTokens(text, allow);
    const content = contentTokens(text);
    if (content.length > 0 && novel.length >= 2 && novel.length / content.length > 0.4) {
      out.push({ kind: "accomplishment", value: text, where });
    }
  }
  return out;
}

function checkProse(
  text: string,
  allow: Allow,
  target: CheckOptions["applicationTarget"],
  where: string,
): Violation[] {
  const out: Violation[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  const chunks = sentences.length ? sentences : [text];
  for (const [i, sentence] of chunks.entries()) {
    const loc = `${where}[${i}]`;
    const claimedWork = EMPLOYMENT_CUE.test(sentence);
    let scanned = sentence;
    if (!claimedWork) {
      if (target?.role) scanned = removePhrase(scanned, target.role);
      if (target?.company) scanned = removePhrase(scanned, target.company);
    }
    out.push(...unsupportedMetrics(scanned, allow, loc));
    out.push(...unsupportedDatesInText(scanned, allow, loc));
    for (const skill of lexiconHits(scanned)) {
      if (!skillOk(skill, allow)) out.push({ kind: "skill", value: skill, where: loc });
    }
    for (const degree of degreeHits(scanned)) {
      if (!degreeOk(degree, allow)) out.push({ kind: "degree", value: degree, where: loc });
    }
    for (const cert of certHits(sentence)) {
      if (!certOk(cert, allow)) out.push({ kind: "certification", value: cert, where: loc });
    }
    for (const school of schoolHits(sentence)) {
      if (!schoolOk(school, allow)) out.push({ kind: "school", value: school, where: loc });
    }
    const titleMatch = scanned.match(TITLE_PHRASE);
    if (titleMatch && !titleOk(titleMatch[0], allow)) {
      out.push({ kind: "title", value: titleMatch[0], where: loc });
    }
    for (const org of orgHits(scanned)) {
      if (!employerSupported(org, allow) && !schoolOk(org, allow) && !phraseIn(org, allow.corpus)) {
        out.push({ kind: "employer", value: org, where: loc });
      }
    }
    if (
      claimedWork &&
      target?.company &&
      phraseIn(target.company, sentence) &&
      !employerSupported(target.company, allow)
    ) {
      out.push({ kind: "employer", value: target.company, where: loc });
    }
  }
  return out;
}

function buildAllow(input: unknown): Allow {
  const textSource = typeof input === "string";
  const resume = textSource ? null : (isResume(input) ? input : null);
  const corpus = textSource ? input : resume ? resumeCorpus(resume) : "";
  const tokens = new Set<string>();
  for (const word of words(corpus)) {
    const stemmed = stem(word);
    if (stemmed.length >= 2) tokens.add(stemmed);
    if (word.length >= 2) tokens.add(word.toLowerCase());
  }

  const orgs: string[] = [];
  const schools: string[] = [];
  const titles: string[] = [];
  const certs: string[] = [];
  const projectNames: string[] = [];
  const degreeLevels = new Set<string>();
  let educationBlob = "";

  if (resume) {
    for (const job of [...(resume.experience ?? []), ...(resume.internships ?? []), ...(resume.earlyCareer ?? [])]) {
      if (job.company) orgs.push(job.company);
      if (job.title) titles.push(job.title);
    }
    for (const school of resume.education ?? []) {
      if (school.name) schools.push(school.name);
      const bits = [school.degree, school.field].filter(Boolean).join(" ");
      educationBlob += ` ${bits} ${school.name ?? ""} ${(school.details ?? []).join(" ")}`;
      const level = degreeLevel(bits);
      if (level) degreeLevels.add(level);
    }
    for (const cert of resume.certifications ?? []) {
      if (cert.name) certs.push(cert.name);
      if (cert.issuer) certs.push(cert.issuer);
    }
    for (const project of resume.projects ?? []) {
      if (project.name) projectNames.push(project.name);
    }
  } else {
    educationBlob = corpus;
    const level = degreeLevel(corpus);
    // A resume can mention more than one level; scan each hit.
    for (const hit of degreeHits(corpus)) {
      const lvl = degreeLevel(hit);
      if (lvl) degreeLevels.add(lvl);
    }
    if (level) degreeLevels.add(level);
  }

  const skillCanons = new Set<string>();
  const skillPhrases = resume ? allSkillPhrases(resume) : [];
  for (const phrase of skillPhrases) {
    const c = canon(normSkill(phrase));
    if (c) skillCanons.add(c);
  }
  for (const group of ALIAS_GROUPS) {
    if (group.some((alias) => tokens.has(stem(alias)) || tokens.has(alias) || corpusHas(corpus, alias))) {
      skillCanons.add(group[0]);
    }
  }
  for (const token of tokens) {
    const c = canon(token);
    if (c !== token || LEXICON.includes(token)) skillCanons.add(c);
  }

  const experienceDateText = resume
    ? [...(resume.experience ?? []), ...(resume.internships ?? []), ...(resume.earlyCareer ?? [])]
        .map((job) => job.date ?? "")
        .join(" ")
    : corpus;
  const educationDateText = resume
    ? (resume.education ?? []).map((school) => [school.startDate, school.endDate].filter(Boolean).join(" ")).join(" ")
    : corpus;

  return {
    textSource,
    corpus,
    corpusNorm: normOrg(corpus),
    tokens,
    orgs,
    schools,
    titles,
    skillCanons,
    degreeLevels,
    educationBlob,
    certs,
    projectNames,
    numbers: extractNumbers(corpus),
    experienceDates: dateFacts(experienceDateText),
    educationDates: dateFacts(educationDateText),
    allDates: dateFacts(corpus),
  };
}

function employerSupported(name: string, allow: Allow): boolean {
  if (allow.orgs.some((org) => orgMatch(name, org, allow))) return true;
  if (allow.textSource && phraseIn(name, allow.corpus)) return true;
  return false;
}

function orgMatch(candidate: string, allowed: string, allow: Allow): boolean {
  const c = normOrg(candidate);
  const a = normOrg(allowed);
  if (!c || !a) return false;
  if (c === a) return true;
  if (c.includes(a) || a.includes(c)) {
    const longer = c.length >= a.length ? c : a;
    const shorter = c.length >= a.length ? a : c;
    const extra = longer.replace(shorter, " ").split(" ").filter(Boolean);
    return extra.every((token) => FILLER.has(token) || allow.tokens.has(stem(token)) || allow.tokens.has(token));
  }
  return false;
}

function titleOk(title: string, allow: Allow): boolean {
  if (allow.textSource) {
    const profile = titleProfile(title);
    for (const flag of profile.seniority) {
      if (!allow.tokens.has(flag)) return false;
    }
    for (const flag of profile.track) {
      if (!corpusHas(allow.corpus, flag === "intern" ? "intern" : flag)) return false;
    }
    return profile.content.every((token) => tokenKnown(token, allow));
  }
  return allow.titles.some((existing) => titlesCompatible(title, existing));
}

function titlesCompatible(candidate: string, existing: string): boolean {
  const c = titleProfile(candidate);
  const e = titleProfile(existing);
  for (const flag of c.seniority) if (!e.seniority.has(flag)) return false;
  for (const flag of c.track) if (!e.track.has(flag)) return false;
  if (e.track.has("intern") && !c.track.has("intern")) return false;
  return c.content.every((token) => e.content.some((other) => tokensMatch(token, other)));
}

function schoolOk(name: string, allow: Allow): boolean {
  if (allow.schools.some((school) => orgMatch(name, school, allow))) return true;
  if (phraseIn(name, allow.corpus) || phraseIn(name, allow.educationBlob)) return true;
  const elite = ELITE_SCHOOLS.find((school) => normOrg(name).includes(school));
  if (elite && !allow.corpusNorm.includes(elite)) return false;
  if (allow.textSource && phraseIn(name, allow.corpus)) return true;
  return false;
}

function degreeOk(text: string, allow: Allow): boolean {
  const level = degreeLevel(text);
  if (level && !allow.degreeLevels.has(level)) return false;
  const fieldTokens = degreeFieldTokens(text);
  return fieldTokens.every((token) => tokenKnown(token, allow) || normOrg(allow.educationBlob).includes(token));
}

function certOk(name: string, allow: Allow): boolean {
  if (allow.certs.some((cert) => orgMatch(name, cert, allow) || phraseIn(name, cert) || phraseIn(cert, name))) return true;
  return phraseIn(name, allow.corpus);
}

function projectOk(name: string, allow: Allow): boolean {
  if (allow.projectNames.some((project) => orgMatch(name, project, allow))) return true;
  if (allow.textSource && phraseIn(name, allow.corpus)) return true;
  return false;
}

function skillOk(phrase: string, allow: Allow): boolean {
  const parts = splitSkill(phrase);
  if (parts.length === 0) return true;
  return parts.every((part) => oneSkillOk(part, allow));
}

function oneSkillOk(phrase: string, allow: Allow): boolean {
  const norm = normSkill(phrase);
  if (!norm) return true;
  const canonical = canon(norm);
  if (allow.skillCanons.has(canonical)) return true;
  if (corpusHas(allow.corpus, norm)) return true;
  const tokens = norm.split(" ").filter((token) => token.length >= 3 && !SKILL_FILLERS.has(token) && !STOP.has(token));
  if (tokens.length === 0) {
    return norm.length <= 2 ? allow.tokens.has(norm) || allow.skillCanons.has(canonical) : true;
  }
  return tokens.every((token) => tokenKnown(stem(token), allow) || tokenKnown(token, allow) || allow.skillCanons.has(canon(token)));
}

function dateFieldOk(value: string, allowed: DateFacts): boolean {
  const got = dateFacts(value);
  for (const pair of got.pairs) if (!allowed.pairs.has(pair)) return false;
  for (const year of got.years) if (!allowed.years.has(year)) return false;
  if (got.open && !allowed.open) return false;
  return true;
}

function unsupportedDatesInText(text: string, allow: Allow, where: string): Violation[] {
  const got = dateFacts(text);
  const out: Violation[] = [];
  for (const pair of got.pairs) {
    if (!allow.allDates.pairs.has(pair)) out.push({ kind: "date", value: pair, where });
  }
  for (const year of got.years) {
    if (!allow.allDates.years.has(year)) out.push({ kind: "date", value: year, where });
  }
  const range = text.match(/\b((?:19|20)\d{2})\s*[-–—/]+\s*((?:19|20)\d{2}|present|current)\b/i);
  if (range) {
    if (!allow.allDates.years.has(range[1])) out.push({ kind: "date", value: range[0], where });
    if (/present|current/i.test(range[2]) && !allow.allDates.open) out.push({ kind: "date", value: range[0], where });
    if (/^(?:19|20)\d{2}$/.test(range[2]) && !allow.allDates.years.has(range[2])) {
      out.push({ kind: "date", value: range[0], where });
    }
  }
  return out;
}

function unsupportedMetrics(text: string, allow: Allow, where: string): Violation[] {
  const out: Violation[] = [];
  for (const num of extractNumbers(text)) {
    if (isAllowedYear(num)) continue;
    const ok = allow.numbers.some(
      (existing) =>
        existing.percent === num.percent &&
        existing.money === num.money &&
        Math.abs(existing.value - num.value) < 1e-6,
    );
    if (!ok) {
      out.push({
        kind: "metric",
        value: `${num.money ? "$" : ""}${num.value}${num.percent ? "%" : ""}`,
        where,
      });
    }
  }
  return out;
}

function isAllowedYear(num: NumTok): boolean {
  if (num.percent || num.money) return false;
  if (!Number.isInteger(num.value)) return false;
  return /^(19|20)\d{2}$/.test(String(num.value));
}

function novelContentTokens(text: string, allow: Allow): string[] {
  return contentTokens(text).filter((token) => !tokenKnown(token, allow));
}

function contentTokens(text: string): string[] {
  const out: string[] = [];
  for (const word of words(text)) {
    const lower = word.toLowerCase();
    if (STOP.has(lower) || VERBS.has(lower) || FILLER.has(lower)) continue;
    if (lower.length < 3) continue;
    if (/^\d/.test(lower)) continue;
    out.push(stem(lower));
  }
  return out;
}

function tokenKnown(token: string, allow: Allow): boolean {
  if (allow.tokens.has(token)) return true;
  for (const existing of allow.tokens) {
    if (tokensMatch(token, existing)) return true;
  }
  return false;
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 5) return false;
  if (!(a.startsWith(b) || b.startsWith(a))) return false;
  return min / max >= 0.8;
}

function titleProfile(title: string): { content: string[]; seniority: Set<string>; track: Set<string> } {
  const seniority = new Set<string>();
  const track = new Set<string>();
  const content: string[] = [];
  const raw = title.toLowerCase().replace(/vice[\s-]+president/g, "vp");
  for (const word of words(raw)) {
    if (["senior", "sr", "staff", "principal", "director", "head", "chief", "manager", "vp", "lead"].includes(word)) {
      seniority.add(word === "sr" ? "senior" : word);
      continue;
    }
    if (["intern", "internship", "junior", "jr", "co-op", "coop", "trainee"].includes(word)) {
      track.add(word === "internship" || word === "coop" || word === "co-op" || word === "trainee" ? "intern" : word === "jr" ? "junior" : word);
      continue;
    }
    if (STOP.has(word) || word.length < 2) continue;
    content.push(stem(word));
  }
  return { content, seniority, track };
}

function degreeLevel(text: string): string | null {
  const s = text.toLowerCase();
  if (/\bph\.?\s?d\b|\bphd\b|\bdoctorate\b|\bdoctor of\b/.test(s)) return "doctorate";
  if (/\bmba\b|\bm\.?\s?s\b|\bm\.?\s?sc\b|\bmaster(?:s|'s)?\b/.test(s)) return "master";
  if (/\bb\.?\s?s\b|\bb\.?\s?a\b|\bb\.?\s?sc\b|\bbachelor(?:s|'s)?\b/.test(s)) return "bachelor";
  if (/\bassociate(?:s|'s)?\b|\ba\.s\b|\ba\.a\b/.test(s)) return "associate";
  return null;
}

function degreeFieldTokens(text: string): string[] {
  const stripped = text
    .toLowerCase()
    .replace(/\b(ph\.?\s?d|phd|doctorate|doctor|mba|m\.?\s?s|m\.?\s?sc|b\.?\s?s|b\.?\s?a|b\.?\s?sc|master(?:s|'s)?|bachelor(?:s|'s)?|associate(?:s|'s)?|of|in|the|a|an|degree)\b/g, " ");
  return words(stripped).map((word) => stem(word)).filter((word) => word.length >= 3 && !STOP.has(word));
}

function degreeHits(text: string): string[] {
  return text.match(new RegExp(DEGREE_WORD, "gi")) ?? [];
}

function certHits(text: string): string[] {
  return text.match(CERT_RE) ?? [];
}

function schoolHits(text: string): string[] {
  const found: string[] = [...(text.match(SCHOOL_RE) ?? [])];
  for (const elite of ELITE_SCHOOLS) {
    const re = new RegExp(`\\b${elite}\\b`, "i");
    if (re.test(text)) found.push(elite);
  }
  return found;
}

function orgHits(sentence: string): string[] {
  const hits: string[] = [];
  const re = /\b(?:at|with|for)\s+([A-Z][\w.&'-]*(?:\s+[A-Z][\w.&'-]*){0,4})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sentence))) {
    const org = match[1].replace(/\b(Inc|LLC|Ltd|Corp)\b\.?$/i, "").trim();
    if (org && !FILLER.has(org.toLowerCase())) hits.push(org);
  }
  return hits;
}

function lexiconHits(text: string): string[] {
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const term of LEXICON) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
    if (re.test(lower)) hits.push(term);
  }
  return hits;
}

function dateFacts(text: string): DateFacts {
  const pairs = new Set<string>();
  const years = new Set<string>();
  const pairRe = new RegExp(`\\b(${MONTH_ALT})\\.?\\s+((?:19|20)\\d{2})\\b`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(text))) {
    pairs.add(`${MONTHS[match[1].toLowerCase()] ?? match[1].toLowerCase().slice(0, 3)}-${match[2]}`);
    years.add(match[2]);
  }
  const yearRe = /\b((?:19|20)\d{2})\b/g;
  while ((match = yearRe.exec(text))) years.add(match[1]);
  const open = /\b((?:19|20)\d{2}|[A-Za-z]{3,9})\s*[-–—/]+\s*(present|current)\b/i.test(text);
  return { pairs, years, open };
}

function extractNumbers(text: string): NumTok[] {
  const cleaned = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, " ");
  const out: NumTok[] = [];
  const re = /\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?\+?%?|\$?\d+(?:\.\d+)?\+?%?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned))) {
    const raw = match[0];
    const after = cleaned.slice(match.index + raw.length, match.index + raw.length + 12);
    const percent = raw.includes("%") || /^\s*percent\b/i.test(after);
    const money = raw.startsWith("$");
    const value = Number(raw.replace(/[$,%+]/g, ""));
    if (Number.isFinite(value)) out.push({ value, percent, money });
  }
  {
    const wordRe = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\b(?:\\s+percent)?`, "gi");
    while ((match = wordRe.exec(cleaned))) {
      const percent = /percent/i.test(match[0]);
      out.push({ value: WORD_NUMBERS[match[1].toLowerCase()], percent, money: false });
    }
  }
  return out;
}

function allSkillPhrases(resume: ResumeShape): string[] {
  const phrases: string[] = [];
  const skills = resume.skills;
  if (Array.isArray(skills)) phrases.push(...skills);
  else if (skills) {
    phrases.push(...(skills.technical ?? []), ...(skills.additional ?? []));
  }
  phrases.push(...(resume.coreCompetencies ?? []));
  for (const project of resume.projects ?? []) phrases.push(...(project.technologies ?? []));
  return phrases.flatMap(splitSkill).filter(Boolean);
}

function splitSkill(phrase: string): string[] {
  const withoutLabel = phrase.includes(":") ? phrase.split(":").slice(1).join(":") : phrase;
  return withoutLabel
    .split(/,|&|\|/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function resumeCorpus(resume: ResumeShape): string {
  const bits: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") bits.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(resume);
  return bits.join("\n");
}

function stem(raw: string): string {
  let token = raw.toLowerCase();
  if (token.endsWith("ing") && token.length > 6) token = token.slice(0, -3);
  else if (token.endsWith("ed") && token.length > 5) token = token.slice(0, -2);
  else if (token.endsWith("es") && token.length > 5) token = token.slice(0, -2);
  else if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) token = token.slice(0, -1);
  return token;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9+#]+(?:\.[a-z0-9+#]+)*/g) ?? [];
}

function normOrg(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|incorporated)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normSkill(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").replace(/\s+/g, " ").trim();
}

function canon(phrase: string): string {
  const norm = normSkill(phrase);
  for (const group of ALIAS_GROUPS) {
    if (group.includes(norm)) return group[0];
  }
  return norm;
}

function phraseIn(phrase: string, corpus: string): boolean {
  const needle = normOrg(phrase);
  if (!needle) return false;
  return normOrg(corpus).includes(needle);
}

function corpusHas(corpus: string, phrase: string): boolean {
  const needle = normSkill(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(corpus.toLowerCase());
}

function removePhrase(text: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "ig"), " ");
}

function dedupe(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  const out: Violation[] = [];
  for (const violation of violations) {
    const key = `${violation.kind}|${violation.where}|${violation.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(violation);
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.where.localeCompare(b.where) || a.value.localeCompare(b.value));
}

type Job = {
  company?: string | null;
  title?: string | null;
  date?: string | null;
  details?: string[] | null;
};

type ResumeShape = {
  personalInfo?: { summary?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null };
  experience?: Job[] | null;
  internships?: Job[] | null;
  earlyCareer?: Job[] | null;
  education?: Array<{
    name?: string | null;
    degree?: string | null;
    field?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    details?: string[] | null;
  }> | null;
  projects?: Array<{
    name?: string | null;
    description?: string | null;
    date?: string | null;
    technologies?: string[] | null;
    details?: string[] | null;
  }> | null;
  skills?: { technical?: string[] | null; additional?: string[] | null } | string[] | null;
  coreCompetencies?: string[] | null;
  certifications?: Array<{ name?: string | null; issuer?: string | null; date?: string | null }> | null;
};

type CoverLetterShape = {
  jobInfo?: { company?: string; position?: string };
  letterContent?: {
    openingParagraph?: string;
    bodyParagraphs?: string[];
    closingParagraph?: string;
  };
};

function isResume(value: unknown): value is ResumeShape {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return "personalInfo" in record || "experience" in record || "education" in record || "skills" in record;
}

function isCoverLetter(value: unknown): value is CoverLetterShape {
  if (!value || typeof value !== "object") return false;
  return "letterContent" in (value as Record<string, unknown>);
}
