import { internal } from "../_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { sha256Hex } from "./keys";

export class AgentError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public hint?: string
  ) {
    super(message);
  }
}

export async function authenticate(
  ctx: GenericActionCtx<DataModel>,
  request: Request
): Promise<string> {
  const header = request.headers.get("Authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key) {
    throw new AgentError(
      401,
      "unauthorized",
      "Missing API key",
      "Send header 'Authorization: Bearer <key>'. Generate a key with: npx convex run agent/keys:generate '{\"userId\":\"<you>\",\"name\":\"cli\"}'"
    );
  }
  const keyHash = await sha256Hex(key);
  const match = await ctx.runQuery(internal.agent.keys.lookupByHash, { keyHash });
  if (!match) {
    throw new AgentError(401, "unauthorized", "Invalid or revoked API key", "Generate a new key and run 'jk auth login <key>'.");
  }
  await ctx.runMutation(internal.agent.keys.markUsed, { id: match.keyId });
  return match.userId;
}
