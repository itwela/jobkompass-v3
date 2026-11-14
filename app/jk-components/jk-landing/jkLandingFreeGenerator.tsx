'use client'

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { trackCtaClicked } from "@/lib/analytics/client";
import { JkTick, jkToneText } from "../jkBars";
import JkDocPreview from "../jkDocPreview";
import { LandingContainer, Reveal, useOnScreen } from "./jkLandingShell";

// 5x7 dot-matrix digits, one string per row.
const DIGITS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

/** The live count on a lantern-lit dot board, at least three digits wide. */
export function DotCounter({ value, compact = false, small = false }: { value: number; compact?: boolean; small?: boolean }) {
  // A "+" follows the count, as in the reference board ("28+").
  const chars = `${Math.max(0, Math.floor(value))}+`.padEnd(3, " ").split("");
  // compact: the phone board from M00, 9px dots on a 13px pitch with no extra gap between digits.
  // small: the D19/M20 board, 5px dots on a ~7px pitch, digits run on with no extra gap.
  const dot = small ? "size-[5px] rounded-full" : compact ? "size-[9px] rounded-full" : "size-2.5 rounded-full";
  return (
    <div role="img" aria-label={`${value} resumes made with the free generator so far`} className={small ? "flex gap-[2px]" : compact ? "flex gap-1" : "flex gap-3"}>
      {chars.map((ch, ci) => (
        <div key={ci} className={small ? "grid grid-cols-5 gap-[2px]" : compact ? "grid grid-cols-5 gap-1" : "grid grid-cols-5 gap-[5px]"}>
          {(DIGITS[ch] ?? Array(7).fill("00000")).flatMap((row, ri) =>
            row.split("").map((on, di) => (
              <span key={`${ri}-${di}`} style={on === "1" ? ({ "--i": ci * 5 + di } as React.CSSProperties) : undefined} className={`${dot} ${on === "1" ? "jk-dot bg-plan" : "bg-border"}`} />
            )),
          )}
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  { title: "Paste text or upload a PDF", body: "We pull out your experience and structure it." },
  { title: "Pick a template", body: "Jake is free. Joseph and Mar are paid." },
  { title: "Download the PDF", body: "Unlimited edits before you export." },
];

export default function JkLandingFreeGenerator() {
  const stats = useQuery(api.freeResumeStats.getStats);
  const total = stats?.totalGenerations ?? 0;
  const playRef = useOnScreen<HTMLDivElement>();
  return (
    <section className="pb-[49px] pt-10 lg:pb-20 lg:pt-16 xl:py-20" aria-labelledby="free-heading">
      <LandingContainer>
        {/* Phone (M00): counter and a resume page in a dark top panel, then copy, steps, and a full-width button. */}
        <Reveal className="overflow-hidden rounded-[28px] border border-input bg-card xl:hidden">
          <div ref={playRef} className="jk-play relative h-[168px] border-b border-border bg-background px-5 pt-[29px]">
            {total > 0 && (
              <>
                {/* The board runs on in unlit dots up to the resume page, so the panel reads as one display at any width. */}
                <div className="mr-[112px] flex gap-1">
                  <DotCounter value={total} compact />
                  <div aria-hidden className="relative h-[87px] min-w-0 flex-1 [mask-image:linear-gradient(to_right,black_60%,transparent)]">
                    <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 4.5px 4.5px, var(--border) 4.5px, transparent 5px)", backgroundSize: "13px 13px" }} />
                    {/* A lantern sheen that only lights the dots it passes over. */}
                    <div className="jk-sheen absolute inset-0" style={{ maskImage: "radial-gradient(circle at 4.5px 4.5px, black 4.5px, transparent 5px)", maskSize: "13px 13px", WebkitMaskImage: "radial-gradient(circle at 4.5px 4.5px, black 4.5px, transparent 5px)", WebkitMaskSize: "13px 13px" }} />
                  </div>
                </div>
                <p className="mt-[13px] max-w-[150px] font-mono text-[9px] font-medium uppercase leading-[14px] tracking-[1.2px] text-subtle-foreground">Resumes made with the free generator so far</p>
              </>
            )}
            <div className="jk-float absolute right-1.5 top-[21px] h-[122px] w-[101px]">
              <JkDocPreview width={90} height={122} className="absolute left-0 top-0 rounded-[4px] bg-paper-warm shadow-none" />
              <span className="absolute right-0 top-[100px] flex h-[22px] w-[46px] items-center justify-center rounded-full bg-plan font-mono text-[9.5px] font-bold tracking-[0.6px] text-plan-foreground">PDF</span>
            </div>
          </div>
          <div className="px-5 pb-[18px] pt-[27px] md:grid md:grid-cols-2 md:gap-x-10 md:px-8 md:pb-8 md:pt-8">
            <div>
            <h2 className="text-[30px] font-medium leading-9 tracking-[-0.6px] text-foreground">Try it without<br />signing up</h2>
            <p className="mt-[7px] text-[14.5px] leading-[22px] text-muted-foreground">Paste your resume text or upload a PDF and get it formatted.</p>
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })} className="mt-6 hidden md:inline-block">
              <Button size="lg" className="jk-fx jk-fx-cream h-12 px-7 text-[15.5px]">Try the free generator</Button>
            </Link>
            </div>
            <ol className="jk-seq mt-[20px] self-center border-t border-border md:mt-0">
              {STEPS.map((st, i) => (
                <li key={st.title} style={{ "--d": `${i * 2}s` } as React.CSSProperties} className="-mx-2 flex h-[52px] items-center rounded-lg border-b border-border px-2">
                  <JkTick tone={(i + 2) as 2 | 3 | 4} className="h-[26px]" />
                  <span className="ml-[11px] w-6 shrink-0 font-mono text-[10px] tracking-[0.6px] text-subtle-foreground">0{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium leading-5 text-foreground">{st.title}</p>
                    <p className="truncate text-xs leading-4 text-muted-foreground">{st.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })} className="mt-[8px] block md:hidden">
              <Button size="lg" className="jk-fx jk-fx-cream h-12 w-full text-[15.5px]">Try the free generator</Button>
            </Link>
          </div>
        </Reveal>
        <Reveal className="hidden items-center gap-14 rounded-[2.25rem] border border-border-strong/70 bg-card p-14 xl:grid xl:grid-cols-[auto_1.25fr_1fr]">
          {total > 0 && (
            <div>
              <DotCounter value={total} />
              <p className="jk-eyebrow mt-6 max-w-44 leading-loose text-subtle-foreground">Resumes made with the free generator so far</p>
            </div>
          )}
          <div>
            <h2 id="free-heading" className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl lg:whitespace-nowrap">Try it without signing up</h2>
            <p className="mt-3 max-w-sm text-muted-foreground">Paste your resume text or upload a PDF and get it formatted.</p>
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })} className="mt-6 inline-block">
              <Button size="lg" className="jk-fx jk-fx-cream h-[52px] px-[26px] text-[15.5px]">Try the free generator</Button>
            </Link>
          </div>
          <ol className="divide-y divide-border">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5 py-4 first:pt-0 last:pb-0">
                <span className={`font-mono text-xs leading-7 ${jkToneText((i + 2) as 2 | 3 | 4)}`}>0{i + 1}</span>
                <div>
                  <p className="text-lg font-medium text-foreground">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </LandingContainer>
    </section>
  );
}
