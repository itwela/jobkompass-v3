'use client'

import { createContext, useContext, useState } from "react";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { components } from "../convex/_generated/api";
import { action } from "../convex/_generated/server";

interface AgentContextType {
    agent: Agent | null;
    setAgent: (agent: Agent) => void;
}

export const AgentContext = createContext<AgentContextType | null>(null);

export const AgentProvider = ({ children }: { children: React.ReactNode }) => {
    const [agent, setAgent] = useState<Agent | null>(null);
    return <AgentContext.Provider value={{ agent, setAgent }}>{children}</AgentContext.Provider>;
}

export const useAgent = () => {
    const context = useContext(AgentContext);
}