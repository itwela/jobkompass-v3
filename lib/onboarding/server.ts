import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { generateResumeLatex } from "@/lib/resume/generators";
import type { ResumeContent } from "@/lib/resume/types";

/** A Convex client acting as the signed-in caller, or null when nobody is signed in. */
export async function convexForCaller(): Promise<ConvexHttpClient | null> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  const token = await convexAuthNextjsToken();
  if (!url || !token) return null;
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}

function latexServiceUrl(): string | null {
  // An explicit URL wins, so local dev can point at the deployed compile service.
  return process.env.LATEX_SERVICE_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8080" : null);
}

/** Renders resume content with a template and returns the PDF bytes. */
export async function compileResumePdf(content: ResumeContent, templateId: string): Promise<Buffer> {
  const service = latexServiceUrl();
  if (!service) throw new Error("LaTeX service not configured");
  const res = await fetch(`${service}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latex: generateResumeLatex(content, templateId), filename: `resume-${Date.now().toString(36)}` }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`LaTeX compilation failed (${res.status})`);
  const { pdfBase64 } = (await res.json()) as { pdfBase64?: string };
  if (!pdfBase64) throw new Error("LaTeX service returned no PDF");
  return Buffer.from(pdfBase64, "base64");
}
