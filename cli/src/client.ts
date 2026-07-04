import { loadConfig } from "./config";

export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint: string | undefined,
    public exitCode: 1 | 2
  ) {
    super(message);
  }
}

type RequestOpts = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

export async function apiRequest(method: string, path: string, opts: RequestOpts = {}): Promise<unknown> {
  const { apiKey, baseUrl } = loadConfig();
  if (!apiKey) {
    throw new CliError(
      "no_key",
      "No API key configured.",
      "Run 'jk auth login <key>' or set JK_API_KEY. Generate a key with: npx convex run agent/keys:generate",
      1
    );
  }
  const url = new URL(baseUrl.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }

  let response: Response;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  };
  try {
    response = await fetch(url, init);
  } catch {
    // One retry on network failure.
    try {
      response = await fetch(url, init);
    } catch (err) {
      throw new CliError("network", `Could not reach ${url.origin}: ${err instanceof Error ? err.message : err}`, "Check your connection and JK_BASE_URL.", 2);
    }
  }

  let payload: { ok?: boolean; data?: unknown; error?: { code?: string; message?: string; hint?: string } };
  try {
    payload = await response.json();
  } catch {
    throw new CliError("bad_response", `Server returned non-JSON (HTTP ${response.status})`, undefined, 2);
  }
  if (payload.ok) return payload.data;
  const err = payload.error ?? {};
  throw new CliError(
    err.code ?? "error",
    err.message ?? `HTTP ${response.status}`,
    err.hint,
    response.status >= 500 ? 2 : 1
  );
}
