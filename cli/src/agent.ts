/**
 * Agent identity for the activity log. Flags beat env vars; nothing is guessed.
 * A value that is not set is not sent, and the server stores "unknown".
 */
export type AgentFlags = { agent?: string; agentId?: string; model?: string; provider?: string };

export const AGENT_ENV = {
  agent: "JK_AGENT_NAME",
  agentId: "JK_AGENT_ID",
  model: "JK_AGENT_MODEL",
  provider: "JK_AGENT_PROVIDER",
} as const;

const HEADER = {
  agent: "X-Agent-Name",
  agentId: "X-Agent-Id",
  model: "X-Agent-Model",
  provider: "X-Agent-Provider",
} as const;

export function agentHeaders(flags: AgentFlags, env: Record<string, string | undefined> = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(HEADER) as (keyof typeof HEADER)[]) {
    const value = (flags[key] ?? env[AGENT_ENV[key]])?.trim();
    // Header values must be ISO-8859-1 without newlines; drop anything else rather than fail the request.
    if (value && /^[\x20-\x7e\xa0-\xff]+$/.test(value)) out[HEADER[key]] = value;
  }
  return out;
}
