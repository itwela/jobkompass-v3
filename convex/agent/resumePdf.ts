import { AgentError } from "./auth";

/**
 * Renders a resume PDF through the app's export route (the single template tier gate)
 * for agent-API actions. Throws AgentError 402 when the template is above the plan and
 * 502 when rendering fails.
 */
export async function exportResumePdf(content: unknown, template: string, rank: number): Promise<ArrayBuffer> {
  const appBaseUrl = process.env.APP_BASE_URL || "https://www.myjobkompass.com";
  const exportResponse = await fetch(`${appBaseUrl}/api/resume/export/${template}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-jk-export-secret": process.env.RESUME_EXPORT_SECRET ?? "",
    },
    body: JSON.stringify({ content, rank }),
  });
  if (!exportResponse.ok) {
    const errorBody = await exportResponse.json().catch(() => ({}));
    // The export route is the single template tier gate; surface its 402 verbatim.
    if (exportResponse.status === 402) {
      throw new AgentError(402, "tier_required", errorBody.message || "This template requires a higher plan.", errorBody.hint);
    }
    throw new AgentError(
      502,
      "generation_failed",
      `Resume PDF generation failed: ${errorBody.error || exportResponse.statusText}`,
      errorBody.details
    );
  }
  return exportResponse.arrayBuffer();
}
