'use client'

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { trackCtaClicked } from "@/lib/analytics/client";
import { JkEyebrow, jkToneText } from "../jkBars";
import { LandingContainer, Reveal } from "./jkLandingShell";

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
};

/** The live count on a lantern-lit dot board, at least three digits wide. */
function DotCounter({ value }: { value: number }) {
  const chars = String(Math.max(0, Math.floor(value))).padEnd(3, " ").split("");
  return (
    <div role="img" aria-label={`${value} resumes made with the free generator so far`} className="flex gap-3">
      {chars.map((ch, ci) => (
        <div key={ci} className="grid grid-cols-5 gap-[5px]">
          {(DIGITS[ch] ?? Array(7).fill("00000")).flatMap((row, ri) =>
            row.split("").map((on, di) => (
              <span key={`${ri}-${di}`} className={on === "1" ? "size-2.5 rounded-full bg-plan" : "size-2.5 rounded-full bg-accent"} />
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
  return (
    <section className="py-16 sm:py-20" aria-labelledby="free-heading">
      <LandingContainer>
        <Reveal className="grid items-center gap-10 rounded-[2.25rem] border border-border-strong/70 bg-card p-8 sm:p-14 lg:grid-cols-[auto_1.25fr_1fr] lg:gap-14">
          {total > 0 && (
            <div>
              <DotCounter value={total} />
              <p className="jk-eyebrow mt-6 max-w-44 leading-loose text-subtle-foreground">Resumes made with the free generator so far</p>
            </div>
          )}
          <div>
            <JkEyebrow tone={3}>03 / Free resume generator</JkEyebrow>
            <h2 id="free-heading" className="mt-4 text-3xl font-medium tracking-tight text-foreground sm:text-4xl lg:whitespace-nowrap">Try it without signing up</h2>
            <p className="mt-3 max-w-sm text-muted-foreground">Paste your resume text or upload a PDF and get it formatted.</p>
            <Link href="/free-resume-generator" onClick={() => trackCtaClicked({ cta: "free_generator", surface: "midpage" })} className="mt-6 inline-block">
              <Button size="lg" className="h-13 px-7 text-base">Try the free generator</Button>
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
