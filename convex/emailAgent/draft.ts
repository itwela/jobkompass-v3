"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { tailorResumeContent, draftReplyMessage, recipientFirstName, tailoredResumeName } from "../../lib/emailAgent/draftMessage";

// Resume-only generation for digest listings ("extracted" leads): there is no sender
// to draft a reply to, but the user still wants a tailored resume PDF to apply with.
// Same tailor -> export-endpoint -> storage pipeline as draftForLead, without touching
// the lead's status or draftMessage.
export const tailorResumeOnly = internalAction({
  args: { leadId: v.id("jobLeads") },
  handler: async (ctx, args) => {
    // Every failure path records a specific, user-readable message on the lead
    // (resumeStatus="error" + resumeError) instead of silently returning, so the
    // Generate-résumé button can flip to an error badge and show the reason on click.
    const fail = async (message: string) => {
      console.error(`tailorResumeOnly ${args.leadId}: ${message}`);
      await ctx.runMutation(internal.jobLeads.setResumeStatus, {
        leadId: args.leadId,
        status: "error",
        error: message,
      });
    };

    try {
      const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
      if (!lead) return; // lead deleted mid-flight — nothing to report to
      if (lead.draftResumeId) return; // already has one

      const resumes: any[] = await ctx.runQuery(internal.documents.listResumesInternal, {
        userId: lead.userId,
      });
      const baseResume = resumes.find((r) => r.isActive) || resumes[0];
      if (!baseResume?.content) {
        return await fail(
          "You don't have a base resume with content yet. Add or activate a resume in My Documents, then try again."
        );
      }

      const tailored = await tailorResumeContent({
        baseContent: baseResume.content,
        company: lead.company,
        role: lead.role,
      });
      if (!tailored) {
        return await fail(
          "The AI couldn't produce a valid tailored resume (invalid output after 2 attempts). Try again in a moment."
        );
      }

      const appBaseUrl = process.env.APP_BASE_URL || "https://www.myjobkompass.com";
      const exportResponse = await fetch(`${appBaseUrl}/api/resume/export/jake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: tailored }),
      });
      if (!exportResponse.ok) {
        const body = await exportResponse.text().catch(() => "");
        return await fail(
          `PDF export failed (HTTP ${exportResponse.status}).${body ? ` ${body.slice(0, 300)}` : ""}`
        );
      }

      const pdfBlob = new Blob([await exportResponse.arrayBuffer()], { type: "application/pdf" });
      const fileId = await ctx.storage.store(pdfBlob);
      const { displayName, fileName } = tailoredResumeName({ content: tailored, company: lead.company, role: lead.role });
      const draftResumeId = await ctx.runMutation(internal.documents.saveGeneratedResumeInternal, {
        userId: lead.userId,
        name: displayName,
        fileId,
        fileName,
        fileSize: pdfBlob.size,
        content: tailored,
        template: baseResume.template || "jake",
      });

      await ctx.runMutation(internal.jobLeads.attachResumeOnly, {
        leadId: args.leadId,
        draftResumeId: draftResumeId as any,
      });
    } catch (err: any) {
      await fail(`Unexpected error: ${err?.message ?? String(err)}`);
    }
  },
});

export const draftForLead = internalAction({
  args: { leadId: v.id("jobLeads"), isFollowUp: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const lead: any = await ctx.runQuery(internal.jobLeads.getById, { leadId: args.leadId });
    if (!lead) return;

    const isFollowUp = args.isFollowUp ?? false;
    // Keep an already-generated tailored resume (e.g. from an earlier "Tailor Resume"
    // click) instead of regenerating it — and never clear it via attachDraft below.
    // Follow-ups deliberately drop it: they don't attach a resume at all (redundant).
    let draftResumeId: string | undefined = isFollowUp ? undefined : (lead.draftResumeId ?? undefined);

    // The tailored-resume PDF is a nice-to-have: any failure in this block (LaTeX service
    // down/unconfigured, tailoring model error) must not prevent the reply draft below
    // from being attached — a lead with a plain draft is actionable, a lead stuck in
    // "new" with no draft is invisible to the approval queue.
    try {
    if (!isFollowUp && !draftResumeId) {
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
            const { displayName, fileName } = tailoredResumeName({ content: tailored, company: lead.company, role: lead.role });
            draftResumeId = await ctx.runMutation(internal.documents.saveGeneratedResumeInternal, {
              userId: lead.userId,
              name: displayName,
              fileId,
              fileName,
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
      senderName: recipientFirstName(lead.senderEmail),
      company: lead.company,
      role: lead.role,
      originalSnippet: lead.rawSnippet,
      isFollowUp,
      // Digest listings have no sender — draft an application message, not a reply.
      isListing: lead.sourceType === "digest_listing",
    });

    await ctx.runMutation(internal.jobLeads.attachDraft, {
      leadId: args.leadId,
      draftResumeId: draftResumeId as any,
      draftMessage: message || "Thanks for reaching out — I'd love to learn more about this opportunity.",
      isFollowUp,
    });
  },
});
