"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { tailorResumeContent, draftReplyMessage } from "../../lib/emailAgent/draftMessage";

export const draftForLead = internalAction({
  args: { leadId: v.id("jobLeads"), isFollowUp: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    const isFollowUp = args.isFollowUp ?? false;
    let draftResumeId: string | undefined;

    // The tailored-resume PDF is a nice-to-have: any failure in this block (LaTeX service
    // down/unconfigured, tailoring model error) must not prevent the reply draft below
    // from being attached — a lead with a plain draft is actionable, a lead stuck in
    // "new" with no draft is invisible to the approval queue.
    try {
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

        if (!tailored) {
          console.error(`draftForLead ${args.leadId}: resume tailoring returned null, no resume will be attached`);
        }
        if (tailored) {
          // PDF generation goes through the app's own export endpoint (same pattern as
          // agent/fns.resumesGenerate): the LaTeX template lives on the Next.js side and
          // is NOT bundled into the Convex deployment, so generateResumeLatex + a raw
          // LaTeX-service call can never work from here.
          const appBaseUrl = process.env.APP_BASE_URL || "https://www.myjobkompass.com";
          const exportResponse = await fetch(`${appBaseUrl}/api/resume/export/jake`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: tailored }),
          });

          if (!exportResponse.ok) {
            console.error(`draftForLead ${args.leadId}: resume PDF export failed (${exportResponse.status})`);
          } else {
            const pdfBlob = new Blob([await exportResponse.arrayBuffer()], { type: "application/pdf" });
            const fileId = await ctx.storage.store(pdfBlob);
            draftResumeId = await ctx.runMutation(internal.documents.saveGeneratedResumeInternal, {
              userId: lead.userId,
              name: `${lead.company} - ${lead.role} (tailored)`,
              fileId,
              fileName: `resume-${lead.company}-${Date.now()}.pdf`,
              fileSize: pdfBlob.size,
              content: tailored,
              template: baseResume.template || "jake",
            });
          }
        }
      }
    }
    } catch (error) {
      console.error(`Tailored resume generation failed for lead ${args.leadId}, attaching draft without resume:`, error);
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
