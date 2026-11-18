'use client'

/**
 * Questions about the resume's own bullets ("How many drivers use the app?"). One at a
 * time, each with the bullet it is about quoted above it. Every question can be skipped
 * and the whole card dismissed: the resume is already saved. Answers are sent in one
 * batch, because each rewrite is a paid regeneration.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BulletAnswer, BulletQuestion, ResumeAnswersResult } from "./types";
import { usableQuestions, usableScorecard } from "./types";

type Phase = "asking" | "sending" | "done" | "error";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function errorText(status: number, body: { error?: string }) {
  if (status === 401) return "Sign in again to update the resume.";
  if (status === 402) return "You have used every document on your plan this month. Your answers are kept here.";
  if (status === 429) return "Too many requests right now. Wait a minute, then try again.";
  return body.error && status < 500 ? body.error : "The resume could not be rewritten. Your answers are kept. Try again.";
}

export interface JkResumeQuestionsCardProps {
  resumeId: string;
  questions: BulletQuestion[];
  onUpdated?: (result: ResumeAnswersResult) => void;
  onDismiss?: () => void;
  className?: string;
}

export default function JkResumeQuestionsCard({ resumeId, questions: initial, onUpdated, onDismiss, className }: JkResumeQuestionsCardProps) {
  const [questions, setQuestions] = useState(() => usableQuestions(initial));
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("asking");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [more, setMore] = useState<BulletQuestion[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  const usage = useQuery(api.usage.canGenerateDocument, {});

  // Focus follows the question, but only once the person has started: never on mount,
  // which would scroll the chat away from what they are reading.
  useEffect(() => {
    if (touched.current && phase === "asking") input.current?.focus();
  }, [step, phase]);

  if (dismissed || (questions.length === 0 && phase !== "done")) return null;

  const total = questions.length;
  const q = questions[Math.min(step, total - 1)] ?? ({} as BulletQuestion);
  const isLast = step >= total - 1;
  const collected = (extra?: string) => {
    const all = { ...answers };
    if (extra !== undefined) {
      if (extra.trim()) all[q.id] = extra.trim();
      else delete all[q.id];
    }
    return all;
  };
  const answeredCount = Object.keys(collected(draft)).length;
  const left = usage && Number.isFinite(usage.limit) && typeof usage.used === "number" ? Math.max(0, (usage.limit as number) - usage.used) : null;

  const submit = async (all: Record<string, string>) => {
    const payload: BulletAnswer[] = questions
      .filter((x) => all[x.id])
      .map((x) => ({ section: x.section, index: x.index, bullet: x.bullet, answer: all[x.id] }));
    if (payload.length === 0) { setPhase("done"); setSent(0); return; }
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/resume/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, answers: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(errorText(res.status, body)); setPhase("error"); return; }
      const next = usableQuestions(body.questions);
      setSent(payload.length);
      setPhase("done");
      setMore(next);
      setAnswers({});
      setDraft("");
      setStep(0);
      onUpdated?.({ resumeId: body.resumeId ?? resumeId, content: body.content, questions: next, scorecard: usableScorecard(body.scorecard) });
    } catch {
      setError("Could not reach JobKompass. Your answers are kept. Try again.");
      setPhase("error");
    }
  };

  const advance = (skip: boolean) => {
    touched.current = true;
    const all = collected(skip ? "" : draft);
    setAnswers(all);
    if (isLast) { void submit(all); return; }
    setStep((s) => s + 1);
    setDraft(all[questions[step + 1]?.id] ?? "");
  };

  const close = () => { setDismissed(true); onDismiss?.(); };

  return (
    <section aria-label="Questions about your resume" className={cn("rounded-[22px] border border-border bg-card p-4 sm:rounded-[20px] sm:px-5 sm:py-[18px]", className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-[20px] text-foreground">
            {phase === "done" ? (sent > 0 ? "Resume updated" : "No answers this time") : "Add the numbers"}
          </p>
          <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
            {phase === "done"
              ? sent > 0
                ? `Rewritten with ${plural(sent, "answer")}. They are saved to your base resume for next time.`
                : "The resume is saved as it is. You can answer later from the same resume."
              : "Optional. A bullet with a real number reads stronger. We only use what you tell us."}
          </p>
        </div>
        {phase !== "sending" && (
          <button type="button" onClick={close} aria-label="Close questions" className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {phase === "done" ? (
        more.length > 0 && sent > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="h-9 px-5 text-[13.5px]" onClick={() => { touched.current = true; setQuestions(more); setMore([]); setPhase("asking"); }}>
              {plural(more.length, "more question")}
            </Button>
            <Button size="sm" variant="secondary" className="h-9 px-5 text-[13.5px]" onClick={close}>Done</Button>
          </div>
        ) : null
      ) : phase === "sending" ? (
        <div className="mt-4 flex items-center gap-3" role="status" aria-live="polite">
          <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-input border-t-foreground" />
          <p className="text-[13.5px] text-foreground">Rewriting the resume with your answers. This takes about a minute.</p>
        </div>
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => { e.preventDefault(); advance(false); }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">
              {q.section === "projects" ? "Project bullet" : "Experience bullet"}
            </p>
            <p className="font-mono text-[11px] text-subtle-foreground" aria-live="polite">{step + 1} of {total}</p>
          </div>
          <blockquote className="mt-2 flex gap-3">
            <span aria-hidden className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full bg-bar-3" />
            <span className="text-[13.5px] leading-[19px] text-muted-foreground">{q.bullet}</span>
          </blockquote>
          <label htmlFor={`rq-${q.id}`} className="mt-4 block text-[15px] font-medium leading-[21px] text-foreground">{q.question}</label>
          <input
            id={`rq-${q.id}`}
            ref={input}
            value={draft}
            onChange={(e) => { touched.current = true; setDraft(e.target.value); }}
            placeholder={q.example ? `e.g. ${q.example}` : "Your answer"}
            autoComplete="off"
            enterKeyHint={isLast ? "done" : "next"}
            className="mt-[10px] h-11 w-full rounded-[12px] border border-input bg-background px-[14px] text-[16px] text-foreground outline-none transition-[border-color] placeholder:text-subtle-foreground focus-visible:border-plan sm:h-10 sm:text-[14.5px]"
          />
          {phase === "error" && error && <p role="alert" className="mt-3 text-[13px] leading-[18px] text-destructive">{error}</p>}
          {left !== null && left <= 2 && answeredCount > 0 && (
            <p className="mt-3 text-[12.5px] leading-[17px] text-muted-foreground">
              {left === 0 ? "Updating needs a document, and you have none left this month." : `Updating uses 1 of your ${plural(left, "document")} left this month.`}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" className="h-9 px-5 text-[13.5px]">
              {isLast ? (answeredCount > 0 ? "Update resume" : "Finish") : "Next"}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-9 px-5 text-[13.5px]" onClick={() => advance(true)}>Skip</Button>
            {!isLast && answeredCount > 0 && (
              <button type="button" onClick={() => { touched.current = true; const all = collected(draft); setAnswers(all); void submit(all); }}
                className="ml-auto text-[13px] font-medium text-foreground underline-offset-4 hover:underline">
                Update resume now
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

/** "6 of 8 bullets have a number · 7/9 must-haves". Small and literal. */
export function JkResumeScorecardLine({ scorecard, className }: { scorecard?: ReturnType<typeof usableScorecard>; className?: string }) {
  if (!scorecard || scorecard.bullets === 0) return null;
  const parts = [`${scorecard.quantified} of ${plural(scorecard.bullets, "bullet")} ${scorecard.quantified === 1 ? "has" : "have"} a number`];
  if (scorecard.dutyStyle > 0) parts.push(`${scorecard.dutyStyle} still ${scorecard.dutyStyle === 1 ? "reads" : "read"} as a duty`);
  if (scorecard.mustHaves && scorecard.mustHaves.total > 0) parts.push(`${scorecard.mustHaves.met}/${scorecard.mustHaves.total} must-haves`);
  return <p className={cn("font-mono text-[11.5px] leading-[16px] text-subtle-foreground", className)}>{parts.join(" · ")}</p>;
}
