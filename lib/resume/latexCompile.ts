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

/**
 * Text from a non-OK `/compile` response.
 * Our compiler puts pdflatex output on `log` and a short reason on `error`.
 * A missing host (Railway "Application not found") uses `message` instead.
 */
export function latexServiceFailureMessage(
  body: { error?: unknown; log?: unknown; message?: unknown } | null | undefined,
  statusText = ""
): string {
  const log = typeof body?.log === "string" ? body.log : "";
  const error = typeof body?.error === "string" ? body.error : "";
  const message = typeof body?.message === "string" ? body.message : "";
  return log || error || message || statusText;
}

/**
 * Hint for AgentError when the Next.js export route fails.
 * That route returns `{ error, log, details }`. Older responses only set `log`,
 * and Convex used to forward `details` alone, so the TeX log never reached the CLI.
 */
export function exportRouteFailureDetails(
  body: { details?: unknown; log?: unknown } | null | undefined
): string | undefined {
  const details = typeof body?.details === "string" ? body.details : "";
  const log = typeof body?.log === "string" ? body.log : "";
  const text = (details || log).slice(0, 2000);
  return text || undefined;
}
