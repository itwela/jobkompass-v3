import type { HttpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { AgentError, authenticate, type AuthedKey } from "./auth";
import { KEY_FORBIDDEN } from "./keyIdentity";
import { agentRoutes, type AgentRoute, type ParamSpec } from "./routes";
import { RANK_PRO } from "../plans";
import { QUESTIONS_RULE } from "./resumeQuestions";
import { AMBIGUOUS, INVALID } from "./resumeMove";
import { internal } from "../_generated/api";
import {
  INVALID_ACTIVITY,
  automaticRow,
  clientFromHeaders,
  forbiddenFields,
  recordSafely,
  resolveIdentity,
  type RowMeta,
  shouldAutoLog,
  withoutUndefined,
} from "./activityLog";

/** Taught to every agent via GET /agent/schema. */
const RESUME_QUESTIONS_WORKFLOW = {
  rule: QUESTIONS_RULE,
  why: "Strong bullets carry numbers and state results, not duties. Only the human knows their numbers.",
  steps: [
    "Optional, before writing: GET /agent/resumes/questions?id=<base resume>[&jobId=<job>] (jk resumes questions). Ask your human each question.",
    "POST /agent/resumes/answers {id, answers:[{id, answer}]} (jk resumes answer) with ONLY what the human said. Saved on the base resume as bulletAnswers; GET /agent/resumes/get shows them.",
    "Write the resume yourself using those answers, then POST /agent/resumes/generate (jk resumes add). The response carries questions + scorecard for bullets still missing a number: relay them, save answers, then PATCH /agent/resumes/content (jk resumes update) to fold them in.",
    "Or let the server write it: POST /agent/resumes/tailor {base, jobId} (jk resumes tailor) uses the saved answers and returns the new resume plus remaining questions.",
  ],
  question: "{id, section: experience|projects, index, bullet, question, example?} — example is a made-up placeholder in the right unit, never a fact",
  scorecard: "{bullets, quantified, dutyStyle, quantifiedPct, mustHaves?: {met, total, missing, matched?: [{term, evidence}]}} — mustHaves only when a jobId is given",
  questionSource: "template (built-in, free, default) | ai (aiQuestions/ai=true; model questions about YOUR text, which is never rewritten) | none (every bullet has a number or is answered)",
};

/** Taught to every agent via GET /agent/schema: who a row is attributed to. */
export const IDENTITY_DOC = {
  precedence: [
    "A key tied to an agent (created with an identity) names every call made with it. Request headers never override a field the key sets.",
    "Exception: model detail. If the key's model is 'claude-sonnet' and X-Agent-Model is 'claude-sonnet-5-5', the row keeps the longer one.",
    "Fields the key does not set come from X-Agent-Name, X-Agent-Id, X-Agent-Model, X-Agent-Provider (self-reported).",
    "Nothing set anywhere: 'unknown' (shown as Unknown agent).",
  ],
  identitySource: "key | header | profile | none, stored on every activity row",
  keys: "POST /agent/keys creates a key (shown once). A key tied to an agent cannot create keys.",
};

/** GET /agent/ping: who the key belongs to and the identity it carries. */
export function pingBody(key: AuthedKey) {
  return { userId: key.userId, app: "jobkompass", key: { name: key.keyName, scoped: key.scoped, identity: key.identity } };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ok(data: unknown): Response {
  return json(200, { ok: true, data: data === undefined ? null : data });
}

function fail(status: number, code: string, message: string, hint?: string): Response {
  return json(status, { ok: false, error: { code, message, ...(hint ? { hint } : {}) } });
}

function coerce(spec: ParamSpec, raw: unknown): unknown {
  if (typeof raw !== "string") return raw; // already typed (JSON body)
  switch (spec.type) {
    case "number": {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new AgentError(400, "invalid_param", `Param '${spec.name}' must be a number, got '${raw}'`);
      return n;
    }
    case "boolean":
      if (raw === "true") return true;
      if (raw === "false") return false;
      throw new AgentError(400, "invalid_param", `Param '${spec.name}' must be 'true' or 'false', got '${raw}'`);
    case "json":
      try {
        return JSON.parse(raw);
      } catch {
        throw new AgentError(400, "invalid_param", `Param '${spec.name}' must be valid JSON`);
      }
    default:
      return raw;
  }
}

async function buildArgs(route: AgentRoute, request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  let raw: Record<string, unknown> = {};
  if (route.method === "GET" || route.method === "DELETE") {
    for (const [k, v] of url.searchParams.entries()) raw[k] = v;
  } else {
    const text = await request.text();
    if (text) {
      try {
        raw = JSON.parse(text);
      } catch {
        throw new AgentError(400, "invalid_body", "Request body must be valid JSON");
      }
    }
  }

  if (route.rejectSecretFields) {
    const bad = forbiddenFields(raw);
    if (bad.length) {
      throw new AgentError(
        400,
        "forbidden_field",
        `Field(s) not allowed: ${bad.join(", ")}. Message bodies, tokens and passwords are never stored`,
        "Send a short summary, and bodyHash (sha256 hex of the body) if you need to prove what was sent."
      );
    }
  }

  const valid = new Set(route.params.map((p) => p.name));
  for (const k of Object.keys(raw)) {
    if (!valid.has(k)) {
      throw new AgentError(400, "unknown_param", `Unknown param '${k}'`, `Valid params: ${[...valid].join(", ") || "(none)"}`);
    }
  }

  const args: Record<string, unknown> = {};
  for (const spec of route.params) {
    let value = raw[spec.name];
    if (value === undefined || value === "") {
      if (spec.default !== undefined) value = spec.default;
      else if (spec.required) {
        throw new AgentError(400, "missing_param", `Missing required param '${spec.name}'`, `GET /agent/schema describes every route's params.`);
      } else continue;
    } else {
      value = coerce(spec, value);
    }
    if (spec.enum && !spec.enum.includes(String(value))) {
      throw new AgentError(400, "invalid_param", `Param '${spec.name}' must be one of: ${spec.enum.join(", ")}`);
    }
    args[spec.name] = value;
  }
  return args;
}

function errorResponse(err: unknown): Response {
  if (err instanceof AgentError) return fail(err.status, err.code, err.message, err.hint);
  const message = err instanceof Error ? err.message : String(err);
  const isArgError = message.includes("ArgumentValidationError") || message.includes("Validator");
  if (message.includes(AMBIGUOUS)) return fail(409, "ambiguous", message.slice(message.indexOf(AMBIGUOUS)), "Pass the id instead of the name.");
  if (message.includes(INVALID)) return fail(400, "invalid_param", message.slice(message.indexOf(INVALID)), "GET /agent/schema describes every route's params.");
  if (message.includes(KEY_FORBIDDEN)) return fail(403, "forbidden", message.slice(message.indexOf(KEY_FORBIDDEN)));
  if (message.includes(INVALID_ACTIVITY)) return fail(400, "invalid_param", message.slice(message.indexOf(INVALID_ACTIVITY)), "GET /agent/schema describes every route's params.");
  const isNotFound = message.includes("not found");
  if (isNotFound) return fail(404, "not_found", message, "List records first to find a valid id.");
  return fail(
    isArgError ? 400 : 500,
    isArgError ? "invalid_args" : "server_error",
    message,
    isArgError ? "GET /agent/schema describes every route's params." : undefined
  );
}

function makeHandler(route: AgentRoute) {
  return httpAction(async (ctx, request) => {
    let key: AuthedKey;
    try {
      key = await authenticate(ctx, request, { requireRank: RANK_PRO });
    } catch (err) {
      return errorResponse(err);
    }
    const userId = key.userId;
    // The key's identity wins over anything the request says about itself.
    const { identity, identitySource } = resolveIdentity(key.identity, request.headers);
    const meta: RowMeta = { keyId: key.keyId, identitySource, client: clientFromHeaders(request.headers) };
    const started = Date.now();
    let args: Record<string, unknown> = {};
    let result: unknown;
    let errorMessage: string | undefined;
    let response: Response;
    try {
      args = await buildArgs(route, request);
      if (route.injectIdentity) {
        args.identity = identity;
        args.identityMeta = withoutUndefined(meta);
      }
      if (route.injectCallerKey) args.callerKey = { id: key.keyId, scoped: key.scoped };
      args.userId = userId; // every agent fn takes explicit userId and enforces ownership
      result =
        route.kind === "query"
          ? await ctx.runQuery(route.fn, args)
          : route.kind === "action"
          ? await ctx.runAction(route.fn, args)
          : await ctx.runMutation(route.fn, args);
      response = ok(result);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      response = errorResponse(err);
    }
    if (shouldAutoLog(route)) {
      // Writes leave an activity row. Logging never changes or fails the response.
      await recordSafely(async () => {
        const row = automaticRow(identity, route, args, { result, error: errorMessage, latencyMs: Date.now() - started }, meta);
        const { keyId: _keyId, ...rest } = withoutUndefined(row);
        await ctx.runMutation(internal.agent.fns.activityRecord, { userId, row: { ...rest, keyId: key.keyId } });
      });
    }
    return response;
  });
}

export function registerAgentRoutes(http: HttpRouter): void {
  http.route({
    path: "/agent/ping",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const key = await authenticate(ctx, request);
        return ok(pingBody(key));
      } catch (err) {
        if (err instanceof AgentError) return fail(err.status, err.code, err.message, err.hint);
        throw err;
      }
    }),
  });

  http.route({
    path: "/agent/schema",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        await authenticate(ctx, request);
        return ok({
          app: "jobkompass",
          envelope: "{ ok: true, data } | { ok: false, error: { code, message, hint } }",
          auth: "Authorization: Bearer <key>",
          identity: IDENTITY_DOC,
          routes: agentRoutes.map(({ fn: _fn, ...rest }) => rest),
          workflows: { resumeQuestions: RESUME_QUESTIONS_WORKFLOW },
        });
      } catch (err) {
        if (err instanceof AgentError) return fail(err.status, err.code, err.message, err.hint);
        throw err;
      }
    }),
  });

  for (const route of agentRoutes) {
    http.route({ path: route.path, method: route.method, handler: makeHandler(route) });
  }
}
