'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/providers/jkAuthProvider";
import JkOnboardingShell from "@/app/jk-components/jk-onboarding/jkOnboardingShell";
import {
  JkOnbJobAside, JkOnbJobStep, JkOnbReadyAside, JkOnbReadyStep, JkOnbResumeAside, JkOnbResumeStep,
  type OnbBase, type OnbJob, type OnbResult,
} from "@/app/jk-components/jk-onboarding/jkOnboardingSteps";
import { toDownloadFileName } from "@/lib/downloadFileName";
import type { ResumeContent } from "@/lib/resume/types";

const ART = { 1: "papers", 2: "chart", 3: "signal" } as const;
const FOOTNOTE = { 1: "PDF or plain text · you can edit everything later", 2: "Works with any job board or company careers page", 3: undefined } as const;

/** First run after sign-up: base resume, one saved job, one tailored resume. */
export default function OnboardingPage() {
  const router = useRouter();
  const convex = useConvex();
  const { isAuthenticated, isLoading } = useAuth();
  const resumes = useQuery(api.documents.listResumes, isAuthenticated ? {} : "skip");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [base, setBase] = useState<OnbBase | null>(null);
  const [job, setJob] = useState<OnbJob | null>(null);
  const [result, setResult] = useState<OnbResult | null>(null);
  const [tailorError, setTailorError] = useState<{ text: string; code?: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const tailoring = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth?mode=signup");
  }, [isLoading, isAuthenticated, router]);

  // Someone who already has a base resume starts with it filled in.
  useEffect(() => {
    if (base || !resumes) return;
    const existing = resumes.find((r) => r.isActive && r.content) ?? null;
    if (existing) setBase({ content: existing.content as ResumeContent, fileName: null, label: existing.name });
  }, [resumes, base]);

  const tailor = useCallback(async (forJob: OnbJob) => {
    if (tailoring.current === forJob.jobId) return;
    tailoring.current = forJob.jobId;
    setTailorError(null);
    setResult(null);
    try {
      const res = await fetch("/api/onboarding/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: forJob.jobId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || "The resume could not be written this time."), { code: data.code });
      setResult(data as OnbResult);
    } catch (e) {
      const err = e as Error & { code?: string };
      setTailorError({ text: err.message || "Could not reach JobKompass.", code: err.code });
      tailoring.current = null;
    }
  }, []);

  useEffect(() => {
    if (step === 3 && job && !result) void tailor(job);
  }, [step, job, result, tailor]);

  const download = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const url = await convex.query(api.documents.getFileUrl, { fileId: result.storageId as Id<"_storage"> });
      if (!url) throw new Error("missing");
      const blob = await (await fetch(url)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = toDownloadFileName(result.fileName.replace(/\.pdf$/i, ""));
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking straight away can cancel the download on mobile Safari.
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      setTailorError({ text: "The PDF could not be downloaded. It is saved in My Documents." });
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading || !isAuthenticated) return <div className="min-h-dvh bg-background" />;

  const skip = () => router.push("/app");
  const aside = step === 1 ? <JkOnbResumeAside base={base} /> : step === 2 ? <JkOnbJobAside job={job} /> : <JkOnbReadyAside base={base} result={result} job={job} />;

  return (
    <JkOnboardingShell
      step={step}
      art={ART[step]}
      onBack={step > 1 ? () => setStep((s) => (s - 1) as 1 | 2) : undefined}
      onSkip={skip}
      aside={aside}
      footnote={FOOTNOTE[step]}
    >
      {step === 1 && <JkOnbResumeStep base={base} onBase={setBase} onContinue={() => setStep(2)} />}
      {step === 2 && (
        <JkOnbJobStep
          job={job}
          onJob={(j) => { setJob(j); setResult(null); tailoring.current = null; }}
          onBack={() => setStep(1)}
          onWrite={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <JkOnbReadyStep
          job={job}
          result={result}
          error={tailorError}
          onRetry={() => job && void tailor(job)}
          onDownload={download}
          downloading={downloading}
          onOpenJobs={() => router.push("/app?mode=my-jobs")}
        />
      )}
    </JkOnboardingShell>
  );
}
