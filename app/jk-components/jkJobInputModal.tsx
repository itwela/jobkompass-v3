'use client'

/**
 * Add job. Desktop D06: dialog with the lighthouse band. Phone M13: bottom sheet.
 * Paste a link (the server fetches the posting) or the posting text; both go through
 * /api/jobs/add, which shares its save path with onboarding (lib/onboarding/saveJob.ts).
 * Footer shows the real plan counter from usage.canAddJob.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { rateLimitMessageFromResponse } from "@/lib/rateLimit/message";
import { useJobs } from "@/providers/jkJobsProvider";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { jkFieldCls, JkFormError } from "./jkField";
import { JkJobsDialog, JkMonoLabel } from "./jk-jobs/jkJobBits";

interface JkJobInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobAdded?: (jobId: Id<"jobs"> | null) => void;
  /** Settings holds the extension key; the hint takes the person there. */
  onOpenExtension?: () => void;
}

export default function JkJobInputModal({ isOpen, onClose, onJobAdded, onOpenExtension }: JkJobInputModalProps) {
  const { allJobs, isAuthenticated } = useJobs();
  const { canAddJob } = useFeatureAccess();
  const can = useQuery(api.usage.canAddJob, isAuthenticated && isOpen ? {} : "skip");
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) { setLink(""); setText(""); setError(null); return; }
    const t = setTimeout(() => linkRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [isOpen]);

  const used = typeof can?.used === "number" ? can.used : allJobs.length;
  const limit = can?.limit ?? null;
  const plan = can?.planLabel ?? "";
  const full = can?.allowed === false;
  const counter = full ? `${used} of ${limit}` : `${used + 1} of ${limit ?? "unlimited"}`;

  const submit = async () => {
    if (busy) return;
    if (full) { canAddJob(); return; }
    if (!link.trim() && text.trim().length < 80) {
      setError(text.trim() ? "Paste the whole posting, not just a line of it." : "Paste a link to the posting, or its text.");
      return;
    }
    setBusy(true);
    setError(null);
    const toastId = toast.loading(link.trim() && !text.trim() ? "Reading the posting..." : "Saving the job...");
    try {
      const res = await fetch("/api/jobs/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text.trim() ? { description: text.trim(), link: link.trim() || undefined } : { link: link.trim() }),
      });
      if (res.status === 429) throw new Error(rateLimitMessageFromResponse(res));
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data?.code === "limit") { toast.dismiss(toastId); canAddJob(); setError(data?.error ?? "Your plan's job limit is reached."); return; }
      if (!res.ok) throw new Error(data?.error || "Could not save that job. Try again.");
      toast.dismiss(toastId);
      toast.success(`Saved ${data?.job?.title ?? "the job"}${data?.job?.company ? ` at ${data.job.company}` : ""}`);
      onJobAdded?.((data?.jobId as Id<"jobs">) ?? null);
      onClose();
    } catch (e) {
      toast.dismiss(toastId);
      setError(e instanceof Error ? e.message : "Could not save that job. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <JkJobsDialog
      open={isOpen}
      onClose={onClose}
      label="Add job"
      width={640}
      artHeight={108}
      mobile="sheet"
      header={
        <div className="px-5 pb-1 pt-7 md:px-8 md:pt-8">
          <p className="flex items-center gap-[11px]">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-plan" />
            <JkMonoLabel className="text-[11px] tracking-[0.14em] text-muted-foreground">Add job</JkMonoLabel>
          </p>
          <h2 className="mt-[14px] text-[28px] font-medium leading-[33px] tracking-[-0.5px] text-foreground md:mt-[13px] md:text-[26px] md:leading-[31px]">
            Paste the link.<br className="md:hidden" /> We save the full posting.
          </h2>
        </div>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-5"
      >
        <JkMonoLabel as="label" htmlFor="jk-add-link" className="mb-[7px] block font-medium">Job link</JkMonoLabel>
        <input
          ref={linkRef}
          id="jk-add-link"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={link}
          onChange={(e) => { setLink(e.target.value); setError(null); }}
          placeholder="https://careers.company.com/job/..."
          className={cn(jkFieldCls, "h-[50px] font-mono md:h-11")}
        />

        <div className="relative my-[26px] hidden items-center md:flex" aria-hidden>
          <span className="h-px flex-1 border-t border-dashed border-border" />
          <span className="px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">Or paste the text</span>
          <span className="h-px flex-1 border-t border-dashed border-border" />
        </div>

        <JkMonoLabel as="label" htmlFor="jk-add-text" className="mb-[7px] hidden font-medium md:block">Posting text</JkMonoLabel>
        <textarea
          id="jk-add-text"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Paste the job description..."
          aria-label="Posting text"
          className={cn(jkFieldCls, "mt-[26px] h-[100px] resize-none rounded-[14px] px-4 py-3.5 text-[14px] md:mt-0 md:h-[130px] md:rounded-xl md:px-3.5")}
        />

        {error && <div className="mt-4"><JkFormError>{error}</JkFormError></div>}

        <button
          type="button"
          onClick={onOpenExtension}
          className="mt-[18px] hidden h-12 w-full items-center gap-[11px] rounded-[14px] border border-border bg-card px-4 text-left text-[13px] text-muted-foreground transition-colors hover:border-input hover:text-foreground md:flex"
        >
          <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-brand" />
          Have the Chrome extension? Save from any posting in one click.
        </button>

        <div className="mt-[26px] flex flex-col items-stretch gap-3 md:mt-9 md:flex-row md:items-center">
          <JkMonoLabel className={cn("order-2 text-center md:order-none md:text-left", full && "text-plan-text")}>
            {counter}{plan ? ` · ${plan}` : ""}
          </JkMonoLabel>
          <Button type="button" variant="ghost" onClick={onClose} className="hidden h-[42px] px-5 text-[14.5px] text-muted-foreground md:ml-auto md:inline-flex">
            Cancel
          </Button>
          <Button type="submit" variant={full ? "plan" : "default"} disabled={busy} className="h-[54px] text-[16.5px] md:h-[42px] md:px-[31px] md:text-[14.5px]">
            {full ? "Upgrade to save more" : busy ? "Saving" : "Save job"}
          </Button>
        </div>
      </form>
    </JkJobsDialog>
  );
}
