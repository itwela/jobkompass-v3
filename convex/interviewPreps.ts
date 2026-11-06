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
        "I'm a Full-Stack AI Engineer focused on building internal AI assistants, RAG knowledge systems, and multi-system API automations that non-technical teams and customers use every day in production.\n\nAt Dope Marketing, I built the internal conversational AI platform on top of millions of client and housing records — writing custom API connectors for internal systems with no off-the-shelf integrations and shipping 3 production tools adopted company-wide that cut manual lookup time from hours to minutes (over 60%).\n\nRight now through Caveman Creative, my core focus is across three production AI systems: I'm the sole engineer embedded with Crescent People on Vous Êtes Héritage (shipping an end-to-end AWS Bedrock & AgentCore book-generation platform with per-request cost telemetry and 38+ production releases); I built and run JobKompass (an AI career platform with 12 custom agent tools, Gmail OAuth triage, and an agent-first CLI); and I built Lotus AI (an iOS wellness app with a multi-LLM multimodal pipeline where I modeled unit economics across dozens of models, hit 100% 8-month retention on early users, and generated five-figure bundle sales). Owning and expanding PTC's GTM Support Assistant lines up directly with what I ship every day.",
      roleSummary:
        "9-month remote contract (with potential extension) at PTC via Mondo. Your 4 Anchor Highlights: (1) Dope Marketing (Internal AI Platform, RAG, Custom Connectors, 3 tools adopted company-wide, >60% faster lookup), (2) Vous Êtes Héritage / Crescent People (Sole engineer, AWS Bedrock & AgentCore, per-request token cost telemetry, Stripe + print fulfillment state machine, 548 commits / 38+ prod releases), (3) JobKompass (12 custom AI agent tools, Gmail OAuth triage, agent-first CLI, LaTeX microservice), and (4) Lotus AI / readio-ios (Multi-LLM multimodal pipeline, model cost/performance unit economics, 100% 8-month user retention, five-figure bundle revenue).",
      flashcards: [
        {
          id: "fc-1",
          category: "experience",
          front: "60-Second Opener: \"Walk me through your background and why this PTC GTM AI role caught your eye.\"",
          back: "Anchor on your **Big 4 Highlights** (`Dope Marketing`, `Vous Êtes Héritage`, `JobKompass`, `Lotus AI`):\n\n1. **Dope Marketing (Internal GTM/Ops AI Anchor):** Built their internal conversational AI platform with RAG + custom connectors over millions of housing/client records — 3 tools adopted company-wide, cutting manual lookup by >60% (hours → minutes).\n2. **Vous Êtes Héritage / Crescent People (Enterprise Bedrock + Cost Telemetry):** Sole embedded engineer taking an AI book platform from 0 to 38+ prod releases on AWS CDK, Amazon Bedrock & AgentCore with per-request token cost telemetry and automated Stripe/print-fulfillment API state machines.\n3. **JobKompass & Lotus AI (Multi-Agent Tooling + Unit Economics):** Built JobKompass (12 custom agent tools, Gmail OAuth inbox triage, `jk` CLI) and Lotus AI (`readio-ios` — multi-LLM multimodal iOS pipeline with 100% 8-month retention, five-figure bundle sales, and deep LLM cost/unit-economics modeling).\n4. **Why PTC:** Owning a live GTM Support Assistant, tightening RAG grounding, wiring enterprise APIs, and managing LLM token costs is the exact intersection of those four systems.",
          hint: "Hit the Big 4: Dope Marketing (RAG/connectors) + Vous Êtes Héritage (Bedrock/cost telemetry) + JobKompass (12 agent tools) + Lotus AI (unit economics/retention).",
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
          category: "experience",
          front: "How do you pitch Vous Êtes Héritage (Crescent People) as proof of enterprise AI, API orchestration, and cost control?",
          back: "**Outcome first:** As the sole embedded engineer, I took a personalized AI book platform from first commit to live production in 4 months (**548+ commits, 38+ production releases**).\n\n• **Agentic & LLM Pipeline:** Built on **Amazon Bedrock and AgentCore** (`Vous_Book_Agent_Main`) — turning recorded interviews (AWS Transcribe) into structured chapters with AI proofreading and image styling.\n• **Token & Cost Telemetry (Direct PTC JD Match):** Engineered per-request token and cost telemetry (`AWSCostAnalyzer`) to keep multi-chapter LLM generation spend visible and predictable (~$5/book cloud budget across up to 100 chapter rewrites).\n• **Enterprise API State Machine:** Integrated Stripe checkout/webhooks with BookVault's print-on-demand fulfillment API via an automated order state machine, protected by 30+ pre-release verification suites.",
          hint: "Sole engineer → 548 commits / 38+ prod releases → AWS Bedrock & AgentCore → per-request cost telemetry → Stripe/BookVault state machine.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-4",
          category: "experience",
          front: "How do you pitch Lotus AI (`readio-ios`) — and why is it such a strong differentiator for this GTM AI role?",
          back: "**Lotus AI (`readio-ios`) proves two things most engineers can't talk about: LLM unit economics (cost-of-goods) and sticky product retention.**\n\n• **What I built:** A consumer iOS AI wellness & audio app (React Native, Convex, OpenAI, Replicate) with a distributed agent pipeline orchestrating multiple LLMs and multimodal generators for automated title, content, voice narration, and cover image generation.\n• **LLM Cost & Unit Economics (Direct PTC JD Match):** Analyzed dozens of model cost/performance tradeoffs across text, TTS, and image providers to price the product with profitable unit economics.\n• **Real-World Outcome:** **100% 8-month retention** across all 9 early organic users (zero paid marketing), and packaged the audio produced in Lotus alongside book bundles to generate **five figures in direct-to-consumer sales**.",
          hint: "Multi-LLM multimodal pipeline + modeled dozens of LLM cost/performance tradeoffs + 100% 8-month retention + 5-figure bundle revenue.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-5",
          category: "objection",
          front: "The Microsoft Copilot Studio Question: \"Do you have hands-on experience with Microsoft Copilot Studio?\"",
          back: "**Rule: Be 100% honest — do NOT fake Copilot Studio. Pivot immediately to the Must-Have (Claude) + identical architectural primitives.**\n\n\"My production work has been primarily in **Claude (Anthropic APIs, Claude Code, Amazon Bedrock, MCP)**, OpenAI, and custom Python/TypeScript agent frameworks rather than Microsoft Copilot Studio specifically — which I noticed is listed as a nice-to-have alongside the Claude must-have.\n\nThat said, the core primitives inside Copilot Studio — topic routing, grounding over enterprise knowledge sources with RAG, calling custom REST connectors/actions, and enforcing auth guardrails — are the exact patterns I've built from scratch at Dope Marketing, in Vous Êtes Héritage, and in JobKompass. Picking up the Copilot Studio UI layer on top of that foundation is very fast for me.\"",
          hint: "Notice the JD: Claude is Must-Have; Copilot Studio is Nice-to-Have. Never bluff Copilot Studio.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-6",
          category: "technical",
          front: "How do you prove hands-on expertise with Claude, Claude Code, Amazon Bedrock, and MCP (Model Context Protocol)?",
          back: "**3 concrete proofs you can cite immediately:**\n\n1. **Production AI Engineering & Agent Tools:** Built multi-step agent systems with tool-calling, structured outputs, and context management across **JobKompass** (12 custom agent tools), **Vous Êtes Héritage** (Amazon Bedrock & AgentCore), **Dope Marketing** (conversational RAG), and **Lotus AI** (multi-LLM orchestration).\n2. **Custom MCP Servers & Agent-First CLIs:** Built and operated custom MCP workflows (Blender MCP, Figcraft MCP, Premiere Pro MCP) and engineered the `jk` CLI specifically so AI agents (like Claude Code) can authenticate via bearer tokens and operate the full JobKompass platform autonomously.\n3. **Credentials & Frameworks:** Completed Anthropic's **Claude 101** and **AI Fluency: Framework & Foundations** certifications.",
          hint: "Mention JobKompass + Vous Êtes Héritage (Bedrock/AgentCore) + custom MCP servers + Anthropic certifications.",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-7",
          category: "technical",
          front: "The JD mentions \"optimizing token usage and managing LLM operational costs.\" How have you done this in production?",
          back: "I have two direct production proofs of managing LLM operational costs:\n\n1. **Vous Êtes Héritage (Per-Request Cost Telemetry on AWS Bedrock):** Built `AWSCostAnalyzer` and per-invocation token/dollar telemetry across multi-chapter book generation and up to 100 chapter rewrites so every book stayed within a ~$5 cloud cost ceiling.\n2. **Lotus AI (`readio-ios` — Model Tradeoff Matrix & Unit Economics):** Benchmarked dozens of LLM, TTS narration, and image generation models on cost-per-generation vs. quality to set profitable product pricing.\n3. **JobKompass (Tiered Model Routing):** Route high-frequency classification/extraction (like Gmail inbox triage and ATS keyword extraction) to fast, low-cost models (`gpt-4o-mini` / `Claude Haiku`) and reserve frontier models for heavy synthesis.",
          hint: "Cite Vous Êtes Héritage (per-request Bedrock cost telemetry) + Lotus AI (unit economics across dozens of models) + JobKompass (tiered routing).",
          confidence: "mastered",
          starred: true,
        },
        {
          id: "fc-8",
          category: "technical",
          front: "How would you approach owning and improving PTC's existing GTM Support Assistant in your first 30 days?",
          back: "1. **Audit failure modes & logs (Week 1):** Review real GTM user queries where the assistant gave low-confidence, ungrounded, or slow responses. Categorize whether failures are **chunking/indexing issues**, **retrieval ranking**, or **prompt/conversation routing**.\n2. **Tighten Grounding & Retrieval (Week 2):** Improve document chunking metadata, hybrid search (keyword + semantic), and strict citation/grounding instructions so the assistant never hallucinates policy or product specs.\n3. **Expand Action Connectors (Weeks 3–4):** Identify the top repetitive manual handoffs (e.g., ticket triage, CRM lookup, case creation) and wire reliable REST API tool calls with schema validation and fallback handling.",
          hint: "Diagnose logs first → fix retrieval/grounding → automate top manual handoff.",
          confidence: "learning",
          starred: false,
        },
        {
          id: "fc-9",
          category: "technical",
          front: "Tell me about your experience integrating enterprise platforms via REST APIs, webhooks, and custom connectors.",
          back: "• **Dope Marketing:** Engineered custom APIs and connectors bridging millions of housing/client database records into internal AI tools where no native integrations existed.\n• **Vous Êtes Héritage:** Integrated Stripe checkout/webhooks with BookVault's print-on-demand fulfillment REST API through a resilient order state machine on AWS Step Functions, SQS, and Lambda.\n• **JobKompass (`jk` + Web):** Built token-authenticated REST APIs (`/api/agent/*`), a Gmail OAuth 2.0 read-only email scanner that auto-detects recruiter replies/interviews, Stripe webhooks, and a containerized Railway LaTeX microservice.",
          hint: "Cite Dope Marketing custom connectors + Vous Êtes Héritage Stripe/BookVault state machine + JobKompass Gmail OAuth & Agent API.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-10",
          category: "technical",
          front: "How do you implement security guardrails, access controls, and prompt-injection protection in internal AI tools?",
          back: "1. **Identity & Row-Level Access Control:** Never rely on the prompt for permissions. Enforce user identity (`userId`, Cognito JWTs/RBAC in Vous Êtes Héritage, or Convex ownership checks in JobKompass) at the API and database layer before retrieved records ever reach the model.\n2. **Input Sanitization & Delimiters:** Clearly separate untrusted external content (like incoming support tickets or emails) from system instructions using structured XML tags.\n3. **Least-Privilege Tool Calling:** Give agents narrow, schema-validated tools (read-only by default; require explicit confirmation or state-machine checks for mutations) plus rate limiting.",
          hint: "Auth at the DB/API layer (Cognito RBAC / Convex userId) + XML delimiters + least-privilege tools.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-11",
          category: "role",
          front: "How have you automated support intake, triage, and routing workflows?",
          back: "Two direct examples:\n\n1. **JobKompass Automated Inbox Triage & Lead Routing:** Built a pipeline that ingests incoming recruiter/application emails via Gmail OAuth, uses LLM structured extraction to classify intent (interview invite, rejection, follow-up, job lead), extracts entities, and routes them directly into the user's pipeline with confidence scores.\n2. **Dope Marketing Ops Workflows:** Replaced manual cross-system lookups and triage with conversational AI workflows that classified internal team requests, pulled the right client/property context automatically, and returned actionable output in minutes instead of hours.",
          hint: "Connect Gmail/Inbox classification + Dope Marketing ops routing directly to GTM support triage.",
          confidence: "learning",
          starred: false,
        },
        {
          id: "fc-12",
          category: "behavioral",
          front: "How do you work with non-technical GTM, operations, or founder stakeholders who don't know how to spec an AI tool?",
          back: "**Examples: Dope Marketing Department Leads + Vous Êtes Héritage Founders**\n\nNon-technical stakeholders rarely ask for \"a RAG pipeline\" or \"an AgentCore state machine\" — they tell you where they're losing hours copying data or where users get stuck. My approach:\n1. **Translate goals into shippable slices:** With Vous Êtes Héritage, I embedded directly with the founders to translate high-level product vision into Jira scope and 38+ production releases.\n2. **Shadow the friction:** At Dope Marketing, I watched what spreadsheets and internal databases reps actually opened, then shipped a working vertical slice in days.\n3. **Iterate on trust & adoption:** Added grounded answers and clear fallbacks so non-technical teams adopted all 3 tools company-wide.",
          hint: "Embed with stakeholders → translate business friction into vertical slices → iterate until adoption sticks.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-13",
          category: "experience",
          front: "JobKompass 90-Second Walkthrough (if Jared asks about your flagship AI agent platform)",
          back: "**JobKompass** is a live multi-tenant AI career & application operations platform I architected and run in production (`myjobkompass.com`):\n\n• **12 Custom AI Agent Tools:** Distributed agent architecture that reads a user's career history, extracts ATS keywords, tailors resumes/cover letters to specific JDs, and coaches their pipeline.\n• **Multi-Surface Architecture:** Next.js 16 + Convex real-time backend + Gmail OAuth 2.0 email triage + a containerized LaTeX PDF microservice on Railway + a 1-click Chrome Extension + the **`jk` agent-first CLI**.\n• **Product Mindset:** Cuts resume/prep workflow time by **60%**, instrumented with PostHog funnel analytics and strict no-invented-experience verification suites.",
          hint: "Highlight: 12 custom agent tools, Gmail OAuth triage, Railway LaTeX microservice, `jk` CLI, 60% time saved.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-14",
          category: "logistics",
          front: "If Jared asks: \"Why did your roles at Dope Marketing and Dataforce end?\"",
          back: "**Keep it crisp, factual, and zero-drama — both were contract engagements:**\n\n• **Dope Marketing (Jul 2025 – Dec 2025):** Fixed contract engagement where I delivered 3 production internal AI tools adopted company-wide; the contract wrapped up at the end of Q4 due to company-wide budget cuts.\n• **Dataforce (Apr 2024 – Jun 2024):** Fixed project contract focused on AI QA and localization pipeline automation across 200+ daily videos; completed the project deliverables (20% error reduction) on schedule.\n• **Since Jan 2026:** Running **Caveman Creative** (building JobKompass, Lotus AI, and embedded client engineering like Vous Êtes Héritage).",
          hint: "Dope = contract ended due to Q4 budget cuts after shipping 3 tools. Dataforce = fixed project contract completed.",
          confidence: "mastered",
          starred: false,
        },
        {
          id: "fc-15",
          category: "logistics",
          front: "Rate & Availability Guardrail: How do you handle the $55/hr rate and start-date questions?",
          back: "• **Rate ($55/hr):** Jared already put **$55/hr** in writing. Confirm cleanly: *\"Yes, $55/hr works for me for this 9-month contract.\"* Ask to confirm that it's a standard **40-hour/week W2** setup through Mondo with potential extension/conversion.\n• **Availability / Start Date Guardrail:** Express immediate readiness for PTC interviews without locking into a specific start day on the recruiter call: *\"I'm available immediately for the hiring manager and technical rounds. Once an offer is finalized, I'd just need a standard 1 to 2 week window to cleanly hand off my current client deliverables.\"*",
          hint: "Confirm $55/hr + 40h/wk W2; ready for interviews immediately, 1–2 weeks notice upon offer.",
          confidence: "mastered",
          starred: true,
        },
      ],
      stories: [
        {
          id: "st-1",
          title: "1. Dope Marketing — Internal Conversational AI & RAG Platform",
          tag: "Highlight #1 · Internal AI + RAG + Custom Connectors",
          hook: "Shipped 3 internal AI tools adopted company-wide, cutting data lookup & synthesis from hours to minutes (>60%).",
          situation:
            "Operations and GTM teams at Dope Marketing were spending hours manually digging through millions of housing and client records across fragmented internal systems that had zero off-the-shelf AI integrations.",
          action:
            "Designed and built an internal conversational AI platform using Python, TypeScript, and RAG. Wrote custom REST API connectors to ingest and query internal databases, engineered grounding and retrieval pipelines for high-accuracy responses, and partnered directly with department leads to scope requirements and train staff.",
          outcome:
            "Reduced manual lookup and synthesis time by over 60% (from hours to minutes) and drove company-wide adoption across 3 production AI tools.",
          takeaway:
            "Directly mirrors PTC's #1 need: owning an internal GTM Support Assistant, improving RAG grounding, and building custom connectors where native plugins don't exist.",
        },
        {
          id: "st-2",
          title: "2. Vous Êtes Héritage (Crescent People) — Enterprise Bedrock Agents & Cost Telemetry",
          tag: "Highlight #2 · AWS Bedrock/AgentCore + Cost Telemetry + API State Machine",
          hook: "Sole embedded engineer taking an AI book platform from first commit to 38+ production releases (548+ commits) in 4 months with per-request LLM cost telemetry.",
          situation:
            "The client needed an end-to-end platform that turns recorded voice interviews into professionally written, print-ready heirloom books with automated physical fulfillment and strict cloud cost control.",
          action:
            "Architected the full AWS CDK stack (Lambda, S3, Cognito, SQS, Step Functions, DynamoDB, Postgres) and built LLM pipelines on Amazon Bedrock and AgentCore (`Vous_Book_Agent_Main`) with AWS Transcribe, AI proofreading, and per-request token/cost telemetry (`AWSCostAnalyzer`). Integrated Stripe checkout/webhooks with BookVault's print-on-demand API via an automated order state machine backed by 30+ pre-release verification suites.",
          outcome:
            "Shipped 38+ production releases across dev/prod environments, kept multi-chapter LLM generation within a predictable ~$5/book cloud budget, and automated order-to-print fulfillment end to end.",
          takeaway:
            "Proves enterprise-grade ownership, Amazon Bedrock/Claude agent orchestration, LLM operational cost management, and complex multi-vendor REST/webhook integration.",
        },
        {
          id: "st-3",
          title: "3. JobKompass — 12-Tool AI Agent Platform, Gmail Triage & Agent-First CLI",
          tag: "Highlight #3 · Multi-Agent Tooling + OAuth Intake Triage",
          hook: "Architected a live multi-tenant AI platform with 12 custom agent tools, automated Gmail OAuth triage, a Chrome extension, and an agent-first CLI that cuts prep time by 60%.",
          situation:
            "Job seekers needed an AI system that didn't just chat, but executed structured, grounded actions across resumes, job pipelines, and incoming recruiter emails without hallucinating facts.",
          action:
            "Built JobKompass using Next.js 16, TypeScript, Convex, and a distributed agent architecture backed by 12 custom tools. Engineered a Gmail OAuth 2.0 classification pipeline for automated email intake/triage, a containerized Railway LaTeX microservice, a 1-click Chrome extension, and the `jk` CLI with API-key auth and per-user ownership checks.",
          outcome:
            "Live in production (`myjobkompass.com`) with real users, cutting tailored document and interview prep time by 60% while enforcing strict user-scoped RBAC and adversarial no-invented-experience checks.",
          takeaway:
            "Demonstrates end-to-end mastery of tool-calling agents, automated support/email triage, and secure multi-surface API design.",
        },
        {
          id: "st-4",
          title: "4. Lotus AI (`readio-ios`) — Multi-LLM Multimodal Pipeline & Unit Economics",
          tag: "Highlight #4 · LLM Cost/Performance Tradeoffs + 100% Retention",
          hook: "Built an iOS AI wellness app orchestrating multiple LLMs and multimodal generators, achieving 100% 8-month user retention and driving five-figure bundle sales.",
          situation:
            "Needed to deliver personalized, narrated audio and visual wellness content on iOS where naive multi-model API calls (text + TTS audio + image generation) would easily destroy unit economics.",
          action:
            "Designed the full React Native iOS interface (`readio-ios`) and engineered a distributed, API-driven agent pipeline orchestrating OpenAI, Replicate, and Convex for automated title, script, voice narration, and image generation. Evaluated dozens of model cost vs. latency/quality tradeoffs to lock in profitable unit economics.",
          outcome:
            "Retained 9 out of 9 early organic users 8 months later (100% retention with zero paid ads) and packaged the Lotus-generated audiobook with book bundles to generate five figures in sales.",
          takeaway:
            "Proves product instinct, multimodal agent orchestration, and the exact LLM operational cost & token-economics discipline PTC asks for in the JD.",
        },
      ],
      requirementMatches: [
        {
          id: "rm-1",
          requirement: "Hands-on experience with Claude (Anthropic models, prompting, tool use, or APIs)",
          priority: "must_have",
          yourProof:
            "Daily production builder with Claude APIs, Amazon Bedrock/AgentCore (Vous Êtes Héritage), Claude Code, and custom MCP servers; Anthropic Certified in 'Claude 101' and 'AI Fluency'.",
          strength: "strong",
        },
        {
          id: "rm-2",
          requirement: "1–3+ years building or configuring AI assistants, chatbots, or workflow automations in a business/enterprise setting",
          priority: "must_have",
          yourProof:
            "Shipped Dope Marketing's internal AI platform (3 tools adopted company-wide), Vous Êtes Héritage (38+ prod releases on AWS Bedrock), JobKompass (12 agent tools), and Lotus AI (`readio-ios`).",
          strength: "strong",
        },
        {
          id: "rm-3",
          requirement: "Understanding of RAG, prompt engineering, and conversation design",
          priority: "must_have",
          yourProof:
            "Architected RAG pipelines over millions of client/housing records at Dope Marketing (cutting lookup time >60%) and multi-context agent workflows in JobKompass and Vous Êtes Héritage.",
          strength: "strong",
        },
        {
          id: "rm-4",
          requirement: "Experience integrating enterprise platforms via APIs (REST, webhooks, custom connectors)",
          priority: "must_have",
          yourProof:
            "Built custom connectors for Dope Marketing internal databases, Stripe + BookVault fulfillment state machines in Vous Êtes Héritage, and Gmail OAuth 2.0 + `/api/agent/*` endpoints in JobKompass.",
          strength: "strong",
        },
        {
          id: "rm-5",
          requirement: "Optimize token usage, manage LLM operational costs & implement security guardrails",
          priority: "must_have",
          yourProof:
            "Built per-request token/cost telemetry (`AWSCostAnalyzer`) in Vous Êtes Héritage, modeled dozens of LLM cost/performance tradeoffs for unit economics in Lotus AI (`readio-ios`), and enforced Cognito JWT/RBAC & Convex row-level auth.",
          strength: "strong",
        },
        {
          id: "rm-6",
          requirement: "Proficiency in Python or JavaScript/TypeScript for custom integrations & data manipulation",
          priority: "must_have",
          yourProof:
            "Primary production stack is Python + TypeScript/Node.js + Next.js + React Native + AWS CDK + SQL/PostgreSQL + Convex across 40+ repositories.",
          strength: "strong",
        },
        {
          id: "rm-7",
          requirement: "Hands-on experience with Microsoft Copilot Studio",
          priority: "nice_to_have",
          yourProof:
            "Honest pivot: Deep production experience with the exact underlying primitives (RAG grounding, topic routing, custom REST actions, auth guardrails) across Dope Marketing, Vous Êtes Héritage, and JobKompass; fast ramp on Copilot Studio UI.",
          strength: "pivot",
        },
        {
          id: "rm-8",
          requirement: "Familiarity with CRM / support / GTM platforms (Salesforce, Dynamics 365, ServiceNow, HubSpot)",
          priority: "nice_to_have",
          yourProof:
            "Built custom CRM/client-record AI connectors at Dope Marketing, automated email/lead triage in JobKompass, and order fulfillment state machines in Vous Êtes Héritage.",
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
