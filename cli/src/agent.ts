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

export const UNSCOPED_KEY_NOTICE =
  "This key has no agent identity, so activity shows whatever the agent sends, or Unknown agent. Tie it to an agent in Settings > CLI keys, or create one with 'jk keys create --agent <name> --model <m> --provider <p>'.";

export const NO_MODEL_WARNING =
  "No model set; activity from this key will show Unknown model unless the agent sends X-Agent-Model / JK_AGENT_MODEL. Add one with --model <m>.";

/** `jk keys create` warns (never fails) when the new key carries no model. */
export function keyModelWarning(body: Record<string, string>): string | undefined {
  return body.model ? undefined : NO_MODEL_WARNING;
}

/** Sent on every request so the activity log can show which client made a call (display only). */
export function clientHeaders(version: string): Record<string, string> {
  return { "User-Agent": `jk/${version}` };
}

/**
 * Body for `jk keys create`: the identity the new key carries, from the --agent, --agent-id,
 * --model and --provider flags only. Env vars are not read, so a key is never scoped by accident.
 */
export function keyIdentityBody(flags: AgentFlags): Record<string, string> {
  const out: Record<string, string> = {};
  const map = { agent: "agentName", agentId: "agentId", model: "model", provider: "provider" } as const;
  for (const key of Object.keys(map) as (keyof typeof map)[]) {
    const value = flags[key]?.trim();
    if (value) out[map[key]] = value;
  }
  return out;
}

export function agentHeaders(flags: AgentFlags, env: Record<string, string | undefined> = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(HEADER) as (keyof typeof HEADER)[]) {
    const value = (flags[key] ?? env[AGENT_ENV[key]])?.trim();
    // Header values must be ISO-8859-1 without newlines; drop anything else rather than fail the request.
    if (value && /^[\x20-\x7e\xa0-\xff]+$/.test(value)) out[HEADER[key]] = value;
  }
  return out;
}
