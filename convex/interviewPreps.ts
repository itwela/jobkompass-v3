import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const flashcardValidator = v.object({
  id: v.string(),
  category: v.string(),
  front: v.string(),
  back: v.string(),
  hint: v.optional(v.string()),
  confidence: v.optional(v.string()),
  starred: v.optional(v.boolean()),
});

export const storyValidator = v.object({
  id: v.string(),
  title: v.string(),
  tag: v.string(),
  hook: v.optional(v.string()),
  situation: v.string(),
  action: v.string(),
  outcome: v.string(),
  takeaway: v.string(),
});

export const requirementMatchValidator = v.object({
  id: v.string(),
  requirement: v.string(),
  priority: v.string(),
  yourProof: v.string(),
  strength: v.string(),
});

export const questionToAskValidator = v.object({
  id: v.string(),
  question: v.string(),
  whyItMatters: v.optional(v.string()),
  category: v.optional(v.string()),
  asked: v.optional(v.boolean()),
  answerNotes: v.optional(v.string()),
});

export const trapValidator = v.object({
  id: v.string(),
  trap: v.string(),
  howToHandle: v.string(),
});

export const checklistItemValidator = v.object({
  id: v.string(),
  label: v.string(),
  done: v.boolean(),
});

async function resolveConvexUserId(ctx: any): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return (user as any).convex_user_id || userId;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) return null;

    const preps = await ctx.db
      .query("interviewPreps")
      .withIndex("by_user", (q) => q.eq("userId", convexUserId))
      .collect();

    return preps.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: { id: v.id("interviewPreps") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) return null;

    const prep = await ctx.db.get(args.id);
    if (!prep || prep.userId !== convexUserId) return null;
    return prep;
  },
});

export const getByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) return null;

    const preps = await ctx.db
      .query("interviewPreps")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    return preps.find((p) => p.userId === convexUserId) ?? null;
  },
});

export const create = mutation({
  args: {
    jobId: v.optional(v.id("jobs")),
    company: v.string(),
    role: v.string(),
    interviewerName: v.optional(v.string()),
    interviewerRole: v.optional(v.string()),
    interviewerEmail: v.optional(v.string()),
    interviewDate: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    phoneBackup: v.optional(v.string()),
    compensationTarget: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    status: v.optional(v.string()),
    elevatorPitch: v.optional(v.string()),
    roleSummary: v.optional(v.string()),
    flashcards: v.optional(v.array(flashcardValidator)),
    stories: v.optional(v.array(storyValidator)),
    requirementMatches: v.optional(v.array(requirementMatchValidator)),
    questionsToAsk: v.optional(v.array(questionToAskValidator)),
    trapsAndGuardrails: v.optional(v.array(trapValidator)),
    checklist: v.optional(v.array(checklistItemValidator)),
    callNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("interviewPreps", {
      userId: convexUserId,
      jobId: args.jobId,
      company: args.company,
      role: args.role,
      interviewerName: args.interviewerName,
      interviewerRole: args.interviewerRole,
      interviewerEmail: args.interviewerEmail,
      interviewDate: args.interviewDate,
      meetingLink: args.meetingLink,
      phoneBackup: args.phoneBackup,
      compensationTarget: args.compensationTarget,
      resumeUsed: args.resumeUsed,
      status: args.status || "upcoming",
      elevatorPitch: args.elevatorPitch,
      roleSummary: args.roleSummary,
      flashcards: args.flashcards || [],
      stories: args.stories || [],
      requirementMatches: args.requirementMatches || [],
      questionsToAsk: args.questionsToAsk || [],
      trapsAndGuardrails: args.trapsAndGuardrails || [],
      checklist: args.checklist || [],
      callNotes: args.callNotes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("interviewPreps"),
    jobId: v.optional(v.id("jobs")),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    interviewerName: v.optional(v.string()),
    interviewerRole: v.optional(v.string()),
    interviewerEmail: v.optional(v.string()),
    interviewDate: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    phoneBackup: v.optional(v.string()),
    compensationTarget: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    status: v.optional(v.string()),
    elevatorPitch: v.optional(v.string()),
    roleSummary: v.optional(v.string()),
    flashcards: v.optional(v.array(flashcardValidator)),
    stories: v.optional(v.array(storyValidator)),
    requirementMatches: v.optional(v.array(requirementMatchValidator)),
    questionsToAsk: v.optional(v.array(questionToAskValidator)),
    trapsAndGuardrails: v.optional(v.array(trapValidator)),
    checklist: v.optional(v.array(checklistItemValidator)),
    callNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) throw new Error("Not authenticated");

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== convexUserId) {
      throw new Error("Interview prep not found or access denied");
    }

    const patchData = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );

    await ctx.db.patch(id, {
      ...patchData,
      updatedAt: Date.now(),
    });
  },
});

export const updateFlashcardConfidence = mutation({
  args: {
    id: v.id("interviewPreps"),
    cardId: v.string(),
    confidence: v.optional(v.string()),
    starred: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== convexUserId) {
      throw new Error("Interview prep not found");
    }

    const updatedCards = existing.flashcards.map((card) => {
      if (card.id !== args.cardId) return card;
      return {
        ...card,
        confidence: args.confidence !== undefined ? args.confidence : card.confidence,
        starred: args.starred !== undefined ? args.starred : card.starred,
      };
    });

    await ctx.db.patch(args.id, {
      flashcards: updatedCards,
      updatedAt: Date.now(),
    });
  },
});

export const toggleChecklistItem = mutation({
  args: {
    id: v.id("interviewPreps"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== convexUserId) {
      throw new Error("Interview prep not found");
    }

    const updatedChecklist = existing.checklist.map((item) =>
      item.id === args.itemId ? { ...item, done: !item.done } : item
    );

    await ctx.db.patch(args.id, {
      checklist: updatedChecklist,
      updatedAt: Date.now(),
    });
  },
});

export const toggleQuestionAsked = mutation({
  args: {
    id: v.id("interviewPreps"),
    questionId: v.string(),
    asked: v.optional(v.boolean()),
    answerNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== convexUserId) {
      throw new Error("Interview prep not found");
    }

    const updatedQuestions = existing.questionsToAsk.map((q) => {
      if (q.id !== args.questionId) return q;
      return {
        ...q,
        asked: args.asked !== undefined ? args.asked : !q.asked,
        answerNotes: args.answerNotes !== undefined ? args.answerNotes : q.answerNotes,
      };
    });

    await ctx.db.patch(args.id, {
      questionsToAsk: updatedQuestions,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("interviewPreps") },
  handler: async (ctx, args) => {
    const convexUserId = await resolveConvexUserId(ctx);
    if (!convexUserId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== convexUserId) {
      throw new Error("Interview prep not found");
    }

    await ctx.db.delete(args.id);
  },
});

// Internal functions for agent / CLI / seeding
export const listInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const preps = await ctx.db
      .query("interviewPreps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return preps.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const upsertInternal = internalMutation({
  args: {
    id: v.optional(v.id("interviewPreps")),
    userId: v.string(),
    jobId: v.optional(v.id("jobs")),
    company: v.string(),
    role: v.string(),
    interviewerName: v.optional(v.string()),
    interviewerRole: v.optional(v.string()),
    interviewerEmail: v.optional(v.string()),
    interviewDate: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    phoneBackup: v.optional(v.string()),
    compensationTarget: v.optional(v.string()),
    resumeUsed: v.optional(v.string()),
    status: v.optional(v.string()),
    elevatorPitch: v.optional(v.string()),
    roleSummary: v.optional(v.string()),
    flashcards: v.array(flashcardValidator),
    stories: v.array(storyValidator),
    requirementMatches: v.optional(v.array(requirementMatchValidator)),
    questionsToAsk: v.array(questionToAskValidator),
    trapsAndGuardrails: v.optional(v.array(trapValidator)),
    checklist: v.array(checklistItemValidator),
    callNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    const now = Date.now();
    if (id) {
      await ctx.db.patch(id, { ...data, status: data.status || "upcoming", updatedAt: now });
      return id;
    }
    return await ctx.db.insert("interviewPreps", {
      ...data,
      status: data.status || "upcoming",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const seedPtcMondoPrep = internalMutation({
  args: {
    userId: v.string(),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, { userId, jobId }) => {
    const existing = await ctx.db
      .query("interviewPreps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const match = existing.find(
      (p) =>
        (jobId && p.jobId === jobId) ||
        p.company.toLowerCase().includes("ptc") ||
        p.interviewerName?.toLowerCase().includes("jared fudge")
    );

    const now = Date.now();

    const payload = {
      userId,
      jobId,
      company: "PTC (via Mondo)",
      role: "GTM AI Solutions Engineer (GTM AI Solutions Analyst)",
      interviewerName: "Jared Fudge",
      interviewerRole: "Senior Technical Recruiter at Mondo",
      interviewerEmail: "jared.fudge@mondo.com",
      interviewDate: "Fri, Nov 6, 2026 · 9:00–9:30 AM EST",
      meetingLink: "https://meet.google.com/pqx-kxor-tyj",
      phoneBackup: "+1 502-791-5557, PIN: 680 273 281#",
      compensationTarget: "$55/hr (9-mo contract + extension; confirm weekly hours & W2 via Mondo)",
      resumeUsed: "Itwela Ibomu Resume - Mondo (Nov 5, 2026 8:59 PM)",
      status: "upcoming",
      elevatorPitch:
        "I'm a Full-Stack AI Engineer focused on building internal AI assistants, RAG knowledge systems, and multi-system API automations that non-technical teams actually use in production.\n\nMost recently at Dope Marketing, I built their internal conversational AI platform on top of millions of client and housing records — writing custom API connectors for internal systems that had no off-the-shelf integrations and shipping 3 production tools that cut manual lookup time from hours to minutes (over 60%).\n\nRight now through Caveman Creative, I also run JobKompass — an AI career platform I built with 12 custom agent tools, an agent-first CLI, and Chrome extension — and automated media/cloud pipelines. Because my day-to-day is building with Claude, Claude Code, MCP servers, and Python/TypeScript API integrations, owning and expanding PTC's GTM Support Assistant felt like an exact match for what I already ship.",
      roleSummary:
        "9-month remote contract (with potential extension) at PTC via Mondo. You will own, maintain, and expand PTC's existing GTM Support Assistant (improving retrieval quality, grounding, and conversation design) while designing new AI-powered GTM workflow automations (support intake, triage, routing, CRM/case/knowledge base integrations, LLM cost & token optimization, and security guardrails). Must-Have: hands-on Claude experience. Nice-to-Have: Microsoft Copilot Studio.",
      flashcards: [
        {
          id: "fc-1",
          category: "experience",
          front: "60-Second Opener: \"Walk me through your background and why this PTC GTM AI role caught your eye.\"",
          back: "Lead with outcome + direct alignment to PTC's 3 pillars (Internal AI Assistants, Custom API Connectors, Claude/Agentic Tooling):\n\n1. **Who I am:** Full-Stack AI Engineer specializing in internal conversational AI, RAG pipelines, and workflow automation for operations and GTM teams.\n2. **Dope Marketing (Anchor Proof):** Built their internal AI platform with RAG + custom connectors to internal databases with no off-the-shelf integrations — shipped 3 tools adopted company-wide, cutting data lookup time by >60% (hours → minutes).\n3. **Caveman Creative / JobKompass (Agentic + Claude Proof):** Built JobKompass with 12 custom AI agent tools, an agent-first CLI, and automated pipelines; daily power user of Claude, Claude Code, and MCP.\n4. **Why PTC:** You already have a live GTM Support Assistant that needs someone to own retrieval quality, expand API integrations across CRM/support tools, and keep token costs and guardrails tight — that's the exact work I do.",
          hint: "Keep it under 60 seconds. Hit Dope Marketing (internal AI + RAG) + Caveman/JobKompass (Claude + 12 agent tools).",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-2",
          category: "experience",
          front: "How does your experience at Dope Marketing map to owning PTC's GTM Support Assistant?",
          back: "**Outcome first:** Shipped 3 internal AI tools adopted company-wide across non-technical departments, cutting data lookup and synthesis time by **>60% (from hours to minutes)**.\n\n• **What I built:** An internal AI platform using **RAG** and conversational workflows over millions of housing and client records.\n• **Custom Connectors:** Their internal systems didn't have off-the-shelf integrations, so I wrote custom Python/TypeScript API connectors and retrieval pipelines.\n• **Iteration with GTM/Ops users:** Partnered directly with department leads to scope high-friction workflows, tune retrieval accuracy so answers were grounded in real records, and iterate on conversation design until non-technical reps trusted it daily.",
          hint: "Anchor on: 3 tools adopted company-wide, >60% lookup time reduction, custom connectors where none existed.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-3",
          category: "objection",
          front: "The Microsoft Copilot Studio Question: \"Do you have hands-on experience with Microsoft Copilot Studio?\"",
          back: "**Rule: Be 100% honest — do NOT fake Copilot Studio. Pivot immediately to the Must-Have (Claude) + identical architectural primitives.**\n\n\"My production work has been primarily in **Claude (Anthropic APIs, Claude Code, MCP)**, OpenAI, and custom Python/TypeScript agent frameworks rather than Microsoft Copilot Studio specifically — which I noticed is listed as a nice-to-have alongside the Claude must-have.\n\nThat said, the core primitives inside Copilot Studio — topic routing, grounding over enterprise knowledge sources with RAG, calling custom REST connectors/actions, and enforcing auth guardrails — are the exact patterns I've built from scratch at Dope Marketing and in JobKompass. Picking up the Copilot Studio UI layer on top of that foundation is very fast for me.\"",
          hint: "Notice the JD: Claude is Must-Have; Copilot Studio is Nice-to-Have. Never bluff Copilot Studio.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-4",
          category: "technical",
          front: "How do you prove hands-on expertise with Claude, Claude Code, and MCP (Model Context Protocol)?",
          back: "**3 concrete proofs you can cite immediately:**\n\n1. **Production AI Engineering & Agent Tools:** Built multi-step agent systems with tool-calling, structured outputs, and context management (12 custom agent tools in JobKompass + conversational RAG at Dope Marketing).\n2. **Custom MCP Servers & Agent-First CLIs:** Built and operated custom MCP workflows (Blender MCP, Figcraft MCP, Premiere Pro MCP) and engineered the `jk` CLI specifically so AI agents (like Claude Code) can authenticate via bearer tokens and operate the full JobKompass platform autonomously.\n3. **Credentials & Frameworks:** Completed Anthropic's **Claude 101** and **AI Fluency: Framework & Foundations** certifications, plus authored a 5-level AI Engineering curriculum covering context engineering, MCP, and agentic orchestration.",
          hint: "Mention both production API/agent architecture AND Anthropic certifications + custom MCP servers.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-5",
          category: "technical",
          front: "How would you approach owning and improving PTC's existing GTM Support Assistant in your first 30 days?",
          back: "1. **Audit failure modes & logs (Week 1):** Review real GTM user queries where the assistant gave low-confidence, ungrounded, or slow responses. Categorize whether failures are **chunking/indexing issues**, **retrieval ranking**, or **prompt/conversation routing**.\n2. **Tighten Grounding & Retrieval (Week 2):** Improve document chunking metadata, hybrid search (keyword + semantic), and strict citation/grounding instructions so the assistant never hallucinates policy or product specs.\n3. **Expand Action Connectors (Weeks 3–4):** Identify the top repetitive manual handoffs (e.g., ticket triage, CRM lookup, case creation) and wire reliable REST API tool calls with schema validation and fallback handling.",
          hint: "Diagnose logs first → fix retrieval/grounding → automate top manual handoff.",
          confidence: "learning",
          starred: true,
        },
        {
          id: "fc-6",
          category: "technical",
          front: "Tell me about your experience integrating enterprise platforms via REST APIs, webhooks, and custom connectors.",
          back: "• **Dope Marketing:** Engineered custom APIs and connectors bridging millions of housing/client database records into internal AI tools where no native integrations existed.\n• **JobKompass (`jk` + Web):** Built token-authenticated REST APIs (`/api/agent/*`), Gmail OAuth 2.0 read-only email scanner to auto-detect recruiter replies/interviews, Stripe subscription webhooks, and a containerized Railway LaTeX microservice.\n• **Kodawari (Caveman Creative):** Built an automated cloud render pipeline orchestrating job queues, storage APIs, and containerized workers — cutting fulfillment from **45 minutes of manual work to under 1 minute (>90% reduction)**.",
          hint: "Cite Dope Marketing custom connectors + JobKompass Gmail OAuth / Agent REST API + Kodawari 45m → 1m.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-7",
          category: "technical",
          front: "The JD mentions \"optimizing token usage and managing LLM operational costs.\" How have you done this in production?",
          back: "I treat LLM cost and latency as first-class engineering metrics:\n\n1. **Tiered Model Routing:** Route classification, triage, and structured extraction to fast, low-cost models (`gpt-4o-mini` / `Claude Haiku`) and reserve frontier reasoning models (`Claude Sonnet/Opus`) only for complex synthesis.\n2. **Context Window Hygiene & Caching:** Instead of stuffing whole documents into prompts, retrieve only top-k relevant chunks with metadata filters and structure static system instructions for prompt caching.\n3. **Per-Request Token & Cost Telemetry:** In my production AI platforms, I log input/output token counts and calculate exact dollar cost per invocation so we can spot expensive prompt regressions immediately.",
          hint: "Model routing (Haiku/Mini vs Sonnet) + Context/RAG pruning + Per-request token telemetry.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-8",
          category: "technical",
          front: "How do you implement security guardrails, access controls, and prompt-injection protection in internal AI tools?",
          back: "1. **Identity & Row-Level Access Control:** Never rely on the prompt for permissions. Enforce user identity (`userId` / RBAC / JWT) at the API and database query layer before retrieved records ever reach the model.\n2. **Input Sanitization & Delimiters:** Clearly separate untrusted external content (like incoming support tickets or emails) from system instructions using structured XML tags (a core Claude best practice).\n3. **Least-Privilege Tool Calling:** Give agents narrow, schema-validated tools (read-only by default; require explicit confirmation or strict state-machine checks for write/mutation actions) plus rate limiting.",
          hint: "Auth at the DB/API layer (not in prompt) + XML delimiters for untrusted input + least-privilege tools.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-9",
          category: "role",
          front: "How have you automated support intake, triage, and routing workflows?",
          back: "Two direct examples:\n\n1. **JobKompass Automated Inbox Triage & Lead Routing:** Built a pipeline that ingests incoming recruiter/application emails via Gmail OAuth, uses LLM structured extraction to classify intent (interview invite, rejection, follow-up, job lead), extracts entities, and routes them directly into the user's pipeline with confidence scores.\n2. **Dope Marketing Ops Workflows:** Replaced manual cross-system lookups and triage with conversational AI workflows that classified internal team requests, pulled the right client/property context automatically, and returned actionable output in minutes instead of hours.",
          hint: "Connect Gmail/Inbox classification + Dope Marketing ops routing directly to GTM support triage.",
          confidence: "learning",
          starred: false,
        },
        {
          id: "fc-10",
          category: "behavioral",
          front: "How do you work with non-technical GTM or operations stakeholders who don't know how to spec an AI tool?",
          back: "**Example: Dope Marketing Department Leads + Client Builds (Champs in 8 Days)**\n\nNon-technical teams rarely ask for \"a RAG pipeline\" — they tell you where they're losing 3 hours a day copying data between tabs. My approach:\n1. **Shadow the friction:** Watch their actual workflow (what spreadsheets, CRM views, or docs they open).\n2. **Ship a working vertical slice fast:** Put a usable prototype in their hands within days (like shipping the Champs dual-app ecosystem in 8 days or the first Dope Marketing assistant).\n3. **Iterate on trust:** Add source citations and clear fallbacks so reps trust the output without needing to understand embeddings or prompts.",
          hint: "Shadow the friction → ship a working slice in days → build trust through citations/reliability.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-11",
          category: "experience",
          front: "JobKompass 90-Second Demo Pitch (if Jared asks about your current projects at Caveman Creative)",
          back: "**JobKompass** is a full-stack AI career & application operations platform I architected and run in production (`myjobkompass.com`):\n\n• **12 Custom AI Agent Tools:** Conversational AI that reads your career history, tailors resumes/cover letters to specific JDs, and tracks pipeline analytics.\n• **Multi-Surface Architecture:** Next.js 16 + Convex real-time backend + a containerized LaTeX PDF microservice on Railway + a Chrome Extension + the **`jk` agent-first CLI**.\n• **Impact:** Cuts tailored resume & prep workflow time by **60%** and is live with real paying tiers and automated email/lead ingestion.",
          hint: "Highlight: 12 custom agent tools, Next.js + Convex + Railway LaTeX microservice, `jk` CLI, 60% time saved.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-12",
          category: "logistics",
          front: "If Jared asks: \"Why did your roles at Dope Marketing and Dataforce end?\"",
          back: "**Keep it crisp, factual, and zero-drama — both were contract engagements:**\n\n• **Dope Marketing (Jul 2025 – Dec 2025):** Fixed contract engagement where I delivered 3 production internal AI tools adopted company-wide; the contract wrapped up at the end of Q4 due to company-wide budget cuts.\n• **Dataforce (Apr 2024 – Jun 2024):** Fixed project contract focused on AI QA and localization pipeline automation across 200+ daily videos; completed the project deliverables (20% error reduction) on schedule.\n• **Since Jan 2026:** Running **Caveman Creative**, shipping production AI systems and full-stack platforms for clients.",
          hint: "Dope = contract ended due to Q4 budget cuts after shipping 3 tools. Dataforce = fixed project contract completed.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-13",
          category: "logistics",
          front: "Rate & Contract Structure Check: How do you handle the $55/hr compensation conversation?",
          back: "Jared already put **$55/hr** in writing in his email.\n\n• **Your response:** \"Yes, $55/hr works for me for this 9-month contract.\"\n• **Follow-up clarifications to ask Jared:**\n  1. Is it structured as a standard **40-hour/week W2** contract through Mondo?\n  2. Does PTC typically extend past 9 months or convert this role to FTE, given the JD mentions building out a broader GTM AI Center of Excellence?",
          hint: "Confirm $55/hr cleanly, then verify 40 hrs/wk W2 and extension/conversion history.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-14",
          category: "logistics",
          front: "Availability & Start Date Guardrail: \"How soon can you start if PTC moves quickly?\"",
          back: "**Guardrail: Express strong readiness to interview immediately, without locking into an exact start date on the recruiter screen.**\n\n\"I'm ready to move through the interview process with PTC right away — my mornings and afternoons are flexible for the hiring manager and technical rounds. Once we have an offer in hand, I typically need about **1 to 2 weeks** to cleanly transition my current client deliverables at Caveman Creative so I can hit the ground running 100% for PTC.\"",
          hint: "Ready for interviews immediately; 1–2 weeks notice upon offer to wrap client handoffs cleanly.",
          confidence: "mastered",
          starred: true,
        },
      ],
      stories: [
        {
          id: "st-1",
          title: "Dope Marketing — Internal Conversational AI & RAG Platform",
          tag: "Primary Anchor · RAG + Custom Connectors",
          hook: "Shipped 3 internal AI tools adopted company-wide, cutting data lookup & synthesis from hours to minutes (>60%).",
          situation:
            "Operations and GTM teams at Dope Marketing were spending hours manually digging through millions of housing and client records across fragmented internal systems that had zero off-the-shelf AI integrations.",
          action:
            "Designed and built an internal conversational AI platform using Python, TypeScript, and RAG. Wrote custom REST API connectors to ingest and query internal databases, engineered grounding and retrieval pipelines for high-accuracy responses, and partnered directly with department leads to iterate on conversation design.",
          outcome:
            "Reduced manual lookup and synthesis time by over 60% (from hours to minutes) and successfully drove company-wide adoption across 3 production AI tools.",
          takeaway:
            "Directly mirrors PTC's need to own an internal GTM Support Assistant, improve RAG grounding, and build custom connectors where native plugins don't exist.",
        },
        {
          id: "st-2",
          title: "JobKompass — 12-Tool AI Agent Platform, CLI & Gmail Triage",
          tag: "Claude / Agentic Systems + Multi-API Integration",
          hook: "Architected an end-to-end AI platform with 12 custom agent tools, OAuth email triage, and an agent-first CLI that cuts workflow time by 60%.",
          situation:
            "Job seekers and operators needed an AI system that didn't just chat, but actually executed structured actions across resumes, job pipelines, and incoming recruiter emails with strict per-user security.",
          action:
            "Built JobKompass using Next.js, TypeScript, Convex, and LLM tool-calling (12 custom agent tools). Added a read-only Gmail OAuth 2.0 classification pipeline for automated email triage, a containerized Railway LaTeX microservice, and the `jk` CLI for programmatic agent workflows.",
          outcome:
            "Cut tailored document and prep creation time by 60% in production while maintaining strict user-scoped access controls, rate limiting, and token-efficient model routing.",
          takeaway:
            "Proves deep hands-on mastery of agentic tool-calling, automated intake/triage, and production full-stack AI architecture.",
        },
        {
          id: "st-3",
          title: "Caveman Creative (Kodawari) — Automated Cloud Fulfillment Pipeline",
          tag: "Workflow Automation · 45 min → <1 min",
          hook: "Eliminated a 45-minute manual fulfillment bottleneck by engineering an event-driven containerized pipeline (<1 min execution, >90% reduction).",
          situation:
            "Creating custom 3D motion-graphics deliverables required a manual 45-minute desktop workflow per order, blocking scale and creating fulfillment delays.",
          action:
            "Engineered Kodawari, a headless containerized render pipeline on AWS/Docker with automated job queuing, parameter injection, health checks, and webhook status updates.",
          outcome:
            "Cut end-to-end processing time from 45 minutes to under 1 minute (>90% reduction) with zero manual intervention.",
          takeaway:
            "Demonstrates how I spot manual operational bottlenecks and replace them with reliable, observable backend automation.",
        },
        {
          id: "st-4",
          title: "Dataforce — High-Throughput AI QA & Localization Automation",
          tag: "Support/QA Triage · 200 Videos/Day",
          hook: "Cut captioning error rates by 20% across 200+ daily videos by automating QA validation and terminology pipelines.",
          situation:
            "High-volume media localization pipelines processing ~200 videos per day suffered from recurring transcription/captioning errors and slow manual QA review.",
          action:
            "Built automated QA checks and terminology consistency scripts inside the AI transcription pipeline, triaging edge-case failures and standardizing validation rules across engineering and linguistic teams.",
          outcome:
            "Reduced captioning error rates by 20% at 200-video/day scale and significantly accelerated turnaround times.",
          takeaway:
            "Shows disciplined quality evaluation, systematic failure analysis, and cross-functional collaboration.",
        },
      ],
      requirementMatches: [
        {
          id: "rm-1",
          requirement: "Hands-on experience with Claude (Anthropic models, prompting, tool use, or APIs)",
          priority: "must_have",
          yourProof:
            "Daily production builder with Claude APIs, Claude Code, and custom MCP servers; Anthropic Certified in both 'Claude 101' and 'AI Fluency: Framework & Foundations'.",
          strength: "strong",
        },
        {
          id: "rm-2",
          requirement: "1–3+ years building or configuring AI assistants, chatbots, or workflow automations in a business/enterprise setting",
          priority: "must_have",
          yourProof:
            "Built Dope Marketing's internal conversational AI platform (3 tools adopted company-wide), JobKompass (12 custom AI agent tools), and automated pipelines at Caveman Creative & Dataforce (2024–2026).",
          strength: "strong",
        },
        {
          id: "rm-3",
          requirement: "Understanding of RAG, prompt engineering, and conversation design",
          priority: "must_have",
          yourProof:
            "Architected RAG pipelines over millions of client/housing records at Dope Marketing (cutting lookup time >60%) and multi-context agent workflows in JobKompass.",
          strength: "strong",
        },
        {
          id: "rm-4",
          requirement: "Experience integrating enterprise platforms via APIs (REST, webhooks, custom connectors)",
          priority: "must_have",
          yourProof:
            "Built custom connectors for Dope Marketing internal systems where no native integrations existed, plus Gmail OAuth 2.0, Stripe webhooks, Railway microservices, and `/api/agent/*` endpoints.",
          strength: "strong",
        },
        {
          id: "rm-5",
          requirement: "Proficiency in Python or JavaScript/TypeScript for custom integrations & data manipulation",
          priority: "must_have",
          yourProof:
            "Primary stack is Python + TypeScript/Node.js + Next.js + SQL/PostgreSQL + Convex across 40+ repositories and production systems.",
          strength: "strong",
        },
        {
          id: "rm-6",
          requirement: "Optimize token usage, manage LLM operational costs & implement security guardrails",
          priority: "must_have",
          yourProof:
            "Implemented tiered model routing, context pruning, per-request token/cost telemetry, user-scoped DB auth checks, and rate limiting in production AI apps.",
          strength: "strong",
        },
        {
          id: "rm-7",
          requirement: "Hands-on experience with Microsoft Copilot Studio",
          priority: "nice_to_have",
          yourProof:
            "Honest pivot: Deep production experience with the exact underlying primitives (RAG grounding, topic routing, custom REST actions, auth guardrails) in Claude/OpenAI/custom stacks; fast ramp on Copilot Studio UI.",
          strength: "pivot",
        },
        {
          id: "rm-8",
          requirement: "Familiarity with CRM / support / GTM platforms (Salesforce, Dynamics 365, ServiceNow, HubSpot)",
          priority: "nice_to_have",
          yourProof:
            "Built custom CRM/client-record AI connectors at Dope Marketing and automated lead/pipeline tracking in JobKompass; comfortable integrating any REST-based enterprise CRM.",
          strength: "transferable",
        },
      ],
      questionsToAsk: [
        {
          id: "q-1",
          question:
            "What stack is PTC's existing GTM Support Assistant built on today — is it primarily Claude via API/Bedrock, or a mix of Claude and Microsoft Copilot Studio?",
          whyItMatters:
            "Immediately uncovers the real day-to-day technical ratio between Claude (your superpower) and Copilot Studio.",
          category: "Technical Stack",
          asked: false,
          answerNotes: "",
        },
        {
          id: "q-2",
          question:
            "What's the biggest pain point with the GTM Support Assistant right now — is the team more focused on fixing retrieval/grounding quality, or building out new workflow automations and connectors?",
          whyItMatters:
            "Lets you tailor your hiring-manager pitch to their #1 immediate fire.",
          category: "Role Priorities",
          asked: false,
          answerNotes: "",
        },
        {
          id: "q-3",
          question:
            "Which GTM systems is the assistant currently connected to (e.g., Salesforce, Dynamics, ServiceNow, SharePoint, Teams), and what's next on the integration roadmap?",
          whyItMatters:
            "Shows you're already thinking like the systems owner who will wire the APIs.",
          category: "Technical Stack",
          asked: false,
          answerNotes: "",
        },
        {
          id: "q-4",
          question:
            "Who does this role report to on the GTM Operations / AI team, and what does the interview process look like after our call today?",
          whyItMatters:
            "Clarifies decision-makers, timeline, and whether there's a technical screen or live architecture walkthrough.",
          category: "Process & Team",
          asked: false,
          answerNotes: "",
        },
        {
          id: "q-5",
          question:
            "Just to confirm the contract structure through Mondo — is this a standard 40-hour/week W2 engagement at the $55/hr rate, and have you seen PTC extend or convert similar roles as they build out their GTM AI Center of Excellence?",
          whyItMatters:
            "Confirms weekly hours, W2 terms, and long-term upside.",
          category: "Compensation & Terms",
          asked: false,
          answerNotes: "",
        },
      ],
      trapsAndGuardrails: [
        {
          id: "tg-1",
          trap: "Overclaiming Microsoft Copilot Studio experience",
          howToHandle:
            "Do NOT claim you've used Copilot Studio in production. Note that it's listed as a Nice-to-Have, highlight your deep Must-Have Claude/MCP/RAG production work, and explain how topic routing + custom connectors + knowledge grounding are identical primitives.",
        },
        {
          id: "tg-2",
          trap: "Getting bogged down in low-level infrastructure tangents on a recruiter screen",
          howToHandle:
            "Jared is a Senior Technical Recruiter — lead every answer with the business outcome (e.g., '>60% faster lookup at Dope Marketing', '45 min to 1 min at Caveman Creative', '3 tools adopted company-wide') before naming the stack.",
        },
        {
          id: "tg-3",
          trap: "Committing to a specific start day on the spot",
          howToHandle:
            "Say you are available immediately for interviews with PTC and need a standard 1–2 week transition window once an offer is finalized.",
        },
        {
          id: "tg-4",
          trap: "Mixing up which resume Jared has in front of him",
          howToHandle:
            "Jared has 'Itwela Ibomu Resume - Mondo' (Caveman Creative, Dope Marketing, Headstarter, Dataforce, WGU, Anthropic Claude 101 & AI Fluency certs). Anchor your primary stories on Dope Marketing and Caveman Creative / JobKompass.",
        },
      ],
      checklist: [
        {
          id: "chk-1",
          label: "Open Google Meet link (https://meet.google.com/pqx-kxor-tyj) 5 mins early at 8:55 AM EST",
          done: false,
        },
        {
          id: "chk-2",
          label: "Keep phone backup handy (+1 502-791-5557, PIN: 680 273 281#) in case Meet audio glitches",
          done: false,
        },
        {
          id: "chk-3",
          label: "Have 'Itwela Ibomu Resume - Mondo' and this JobKompass Interview Prep deck open side-by-side",
          done: false,
        },
        {
          id: "chk-4",
          label: "Run through the 4 Starred Flashcards once out loud (60s Opener, Dope Marketing RAG, Copilot Studio Pivot, Claude/MCP Proof)",
          done: false,
        },
        {
          id: "chk-5",
          label: "Confirm $55/hr rate, weekly hours (40h/wk), and next interview steps with PTC hiring manager before hanging up",
          done: false,
        },
      ],
      callNotes:
        "Recruiter Screen with Jared Fudge (Mondo) — Fri Nov 6, 2026 @ 9:00 AM EST.\n\nLive Call Notes:\n- Current stack PTC uses for GTM Support Assistant:\n- Top priority in first 30-60 days:\n- Hiring manager & interview stages:\n- Contract hours / start timeline:",
      updatedAt: now,
    };

    if (match) {
      await ctx.db.patch(match._id, payload);
      return match._id;
    }

    return await ctx.db.insert("interviewPreps", {
      ...payload,
      createdAt: now,
    });
  },
});
