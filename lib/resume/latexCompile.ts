/**
 * POST body for `${LATEX_SERVICE_URL}/compile`.
 *
 * The Cloud Run sample in LATEX_SERVICE_SETUP.md reads `latexContent` and
 * returns 400 `{ error: "latexContent is required" }` when that field is
 * missing. Resume export, chat tools, and the cover-letter route used to send
 * only `latex`, so every template failed before pdflatex ran. The free-resume
 * route already sent both names. Send both, with the same source, so a service
 * that reads either field compiles.
 */
export function latexCompileRequestBody(source: string, filename: string): {
  latex: string;
  latexContent: string;
  filename: string;
} {
  return {
    latex: source,
    latexContent: source,
    filename,
  };
}

/** Shown when `/compile` fails without a TeX log. Railway's missing app is this case. */
export const EMPTY_COMPILE_LOG_HINT = "empty body / Application not found";

type CompileErrorBody = {
  error?: unknown;
  log?: unknown;
  message?: unknown;
  status?: unknown;
} | null | undefined;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Split a non-OK `/compile` response into the raw TeX log and the string agents should see.
 * A real log is kept. A blank log (Vercel: `error: undefined, log: ''` on HTTP 404)
 * still produces details that name the status and the missing-service hint.
 */
export function latexCompileFailureReport(
  body: CompileErrorBody,
  status: number,
  statusText = ""
): { log: string; details: string } {
  const log = text(body?.log);
  if (log) {
    return { log, details: log.slice(0, 2000) };
  }

  const statusLabel = status > 0 ? `HTTP ${status}` : text(statusText) || "non-OK";
  const extras = [text(body?.error), text(body?.message)].filter(
    (part) => part.length > 0 && part !== "Application not found"
  );
  const details = extras.length
    ? `${statusLabel}: ${EMPTY_COMPILE_LOG_HINT} — ${extras.join(" — ")}`
    : `${statusLabel}: ${EMPTY_COMPILE_LOG_HINT}`;
  return { log: "", details: details.slice(0, 2000) };
}

/** Single string for callers that only store one failure message. */
export function latexServiceFailureMessage(
  body: CompileErrorBody,
  statusText = "",
  status = 0
): string {
  return latexCompileFailureReport(body, status, statusText).details;
}

/**
 * Hint for AgentError when the Next.js export route fails.
 * The route returns `{ error, log, details }`. A blank `log` must not drop the hint:
 * older Convex only read `details`, and a 404 from Railway leaves `log` empty.
 */
export function exportRouteFailureDetails(body: CompileErrorBody & { details?: unknown }): string {
  const details = text(body?.details);
  const log = text(body?.log);
  const textValue = (details || log).slice(0, 2000);
  if (textValue) return textValue;
  // `error` on this JSON is the route wrapper ("LaTeX compilation failed"), not the
  // compiler's reason. A blank log still needs the missing-service hint.
  const status = typeof body?.status === "number" ? body.status : 0;
  return latexCompileFailureReport({ message: body?.message }, status).details;
}
