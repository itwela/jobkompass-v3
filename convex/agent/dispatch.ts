import type { HttpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { AgentError, authenticate } from "./auth";
import { agentRoutes, type AgentRoute, type ParamSpec } from "./routes";

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

function makeHandler(route: AgentRoute) {
  return httpAction(async (ctx, request) => {
    try {
      const userId = await authenticate(ctx, request);
      const args = await buildArgs(route, request);
      args.userId = userId; // every agent fn takes explicit userId and enforces ownership
      const result =
        route.kind === "query"
          ? await ctx.runQuery(route.fn, args)
          : await ctx.runMutation(route.fn, args);
      return ok(result);
    } catch (err) {
      if (err instanceof AgentError) return fail(err.status, err.code, err.message, err.hint);
      const message = err instanceof Error ? err.message : String(err);
      const isArgError = message.includes("ArgumentValidationError") || message.includes("Validator");
      const isNotFound = message.includes("not found");
      if (isNotFound) return fail(404, "not_found", message, "List records first to find a valid id.");
      return fail(
        isArgError ? 400 : 500,
        isArgError ? "invalid_args" : "server_error",
        message,
        isArgError ? "GET /agent/schema describes every route's params." : undefined
      );
    }
  });
}

export function registerAgentRoutes(http: HttpRouter): void {
  http.route({
    path: "/agent/ping",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const userId = await authenticate(ctx, request);
        return ok({ userId, app: "jobkompass" });
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
          routes: agentRoutes.map(({ fn: _fn, ...rest }) => rest),
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
