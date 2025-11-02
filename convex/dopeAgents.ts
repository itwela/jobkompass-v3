import { components } from "./_generated/api";
import { internal } from "./_generated/api";
import { Agent, saveMessage, listMessages } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { action, query, mutation, internalAction } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Agent as OpenAIAgent, Handoff } from '@openai/agents';

const sharedDefaults = {
    // The chat completions model to use for the agent.
    languageModel: openai.chat("gpt-4o-mini"),
    // Embedding model to power vector search of message history (RAG).
    // textEmbeddingModel: openai.embedding("text-embedding-3-small"),
}

// Type to make Convex Agent compatible with OpenAI Agent handoff
type ConvexAgentAsHandoff = Handoff<any, any>;


const resumeAgent = new Agent(components.agent, {
    name: 'Resume agent',
    instructions: ``,
    ...sharedDefaults,
});


// Use Agent.create method to ensure the finalOutput type considers handoffs
const triageAgent = OpenAIAgent.create({
    name: 'Triage agent',
    handoffs: [
        resumeAgent as unknown as Handoff,
    ],
});
