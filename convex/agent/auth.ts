import { internal } from "../_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { sha256Hex } from "./keys";
import { rankLabel, type PlanRank } from "../plans";

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
  request: Request,
  opts?: { requireRank?: PlanRank }
): Promise<string> {
  const header = request.headers.get("Authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key) {
    throw new AgentError(
      401,
      "unauthorized",
      "Missing API key",
      "Send header 'Authorization: Bearer <key>'. Create a key in JobKompass under Settings -> Command Line & AI Agents."
    );
  }
  const keyHash = await sha256Hex(key);
  const match = await ctx.runQuery(internal.agent.keys.lookupByHash, { keyHash });
  if (!match) {
    throw new AgentError(401, "unauthorized", "Invalid or revoked API key", "Generate a new key and run 'jk auth login <key>'.");
  }
  await ctx.runMutation(internal.agent.keys.markUsed, { id: match.keyId });

  if (opts?.requireRank) {
    const rank = await ctx.runQuery(internal.agent.fns.agentPlanRank, {
      userId: match.userId,
    });
    if (rank < opts.requireRank) {
      throw new AgentError(
        402,
        "subscription_required",
        `The JobKompass CLI requires the ${rankLabel(opts.requireRank)} plan.`,
        "Upgrade at https://www.myjobkompass.com/pricing. Run 'jk auth status' to confirm which account this key belongs to."
      );
    }
  }

  return match.userId;
}
