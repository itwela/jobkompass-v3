"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { tailorResumeContent, draftReplyMessage } from "../../lib/emailAgent/draftMessage";
import { generateResumeLatex } from "../../lib/resume/generators";

export const draftForLead = internalAction({
  args: { leadId: v.id("jobLeads"), isFollowUp: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    const isFollowUp = args.isFollowUp ?? false;
    let draftResumeId: string | undefined;

    if (!isFollowUp) {
      const resumes: any[] = await ctx.runQuery(internal.documents.listResumesInternal, {
        userId: lead.userId,
      });
      const baseResume = resumes.find((r) => r.isActive) || resumes[0];

      if (baseResume?.content) {
        const tailored = await tailorResumeContent({
          baseContent: baseResume.content,
          company: lead.company,
          role: lead.role,
        });

        if (tailored) {
          const latexTemplate = generateResumeLatex(tailored, baseResume.template || "jake");
          const LATEX_SERVICE_URL =
            process.env.NODE_ENV === "development" ? "http://127.0.0.1:8080" : process.env.LATEX_SERVICE_URL;

          if (LATEX_SERVICE_URL) {
            const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latex: latexTemplate, filename: `resume-${lead._id}` }),
            });

            if (compileResponse.ok) {
              const { pdfBase64 } = await compileResponse.json();
              if (pdfBase64) {
                const pdfBuffer = Buffer.from(pdfBase64, "base64");
                const uploadUrl: string = await ctx.runMutation(internal.documents.generateUploadUrlInternal, {});
                const uploadResponse = await fetch(uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/pdf" },
                  body: new Uint8Array(pdfBuffer),
                });
                if (uploadResponse.ok) {
                  const { storageId } = await uploadResponse.json();
                  draftResumeId = await ctx.runMutation(internal.documents.saveGeneratedResumeInternal, {
                    userId: lead.userId,
                    name: `${lead.company} - ${lead.role} (tailored)`,
                    fileId: storageId,
                    fileName: `resume-${lead.company}-${Date.now()}.pdf`,
                    fileSize: pdfBuffer.length,
                    content: tailored,
                    template: baseResume.template || "jake",
                  });
                }
              }
            }
          }
        }
      }
    }

    const message = await draftReplyMessage({
      senderName: lead.senderEmail || "there",
      company: lead.company,
      role: lead.role,
      originalSnippet: lead.rawSnippet,
      isFollowUp,
    });

    await ctx.runMutation(internal.jobLeads.attachDraft, {
      leadId: args.leadId,
      draftResumeId: draftResumeId as any,
      draftMessage: message || "Thanks for reaching out — I'd love to learn more about this opportunity.",
      isFollowUp,
    });
  },
});
