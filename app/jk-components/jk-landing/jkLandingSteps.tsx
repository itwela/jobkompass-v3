'use client'

import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { jkToneText } from "../jkBars";
import JkDocPreview from "../jkDocPreview";
import JkStatusBar from "../jkStatusBar";
import { JkStatusGlyph } from "../jkStatusChip";
import { STATUS_TEXT, statusKey } from "@/lib/jkStatus";
import { JkTick } from "../jkBars";
import JkScaleToFit from "../jkScaleToFit";
import { LandingContainer, Reveal, SectionHeading, useOnScreen } from "./jkLandingShell";

const SAMPLE_JOBS = [
  { title: "GTM AI Solutions Eng...", status: "Interviewing", date: "11-05" },
  { title: "Applied AI Engineer", status: "Applied", date: "11-03" },
  { title: "Full Stack Engineer", status: "Offered", date: "10-28" },
  { title: "Solutions Engineer", status: "Ghosted", date: "10-14" },
  { title: "Backend Engineer", status: "Rejected", date: "10-09" },
];
const SAMPLE_COUNTS = [
  { status: "Interested", count: 150 }, { status: "Applied", count: 38 }, { status: "Interviewing", count: 2 },
  { status: "Offered", count: 4 }, { status: "Rejected", count: 12 }, { status: "Ghosted", count: 30 },
];

// Each mock is drawn for the reference's 262px-square panel.

function SaveMock() {
  return (
    <div className="flex h-full flex-col px-[18px] pt-[31px]">
      <p className="font-mono text-[9.5px] uppercase tracking-[1.6px] text-subtle-foreground">Add job</p>
      <p className="mt-[9px] flex h-[38px] items-center truncate rounded-full border-[1.5px] border-plan px-3.5 font-mono text-[11px] text-foreground">
        <span className="jk-type">careers.blackrock.com/job/22417</span><span className="jk-caret ml-px inline-block h-3.5 w-px shrink-0 bg-plan" />
      </p>
      <ArrowDown className="jk-arrow mx-auto my-[13px] size-[18px] text-border-strong" strokeWidth={1.5} />
      <div className="jk-drop rounded-[14px] border border-input bg-card px-3.5 pb-3 pt-[13px]">
        <p className="font-mono text-[9.5px] uppercase tracking-[1.4px] text-ok">Saved to My Jobs</p>
        <p className="mt-[7px] text-[15px] font-medium leading-5 text-foreground">AI Engineer</p>
        <p className="text-[11.5px] text-muted-foreground">BlackRock · New York</p>
        <p className="mt-[7px] flex items-center justify-between text-[11.5px] text-foreground">
          <span className="flex items-center gap-2"><JkStatusGlyph status="Interested" className="size-3.5" />Interested</span>
          <span className="font-mono text-[11px]">$$$$</span>
        </p>
      </div>
    </div>
  );
}

// Pill and connector geometry from the frame's 262px panel.
const CHANGES = [
  { top: 34, from: 56, lines: ["Claude Code", "leads"] },
  { top: 78, from: 80, lines: ["MCP first", "in skills"] },
  { top: 132, from: 108, lines: ["Projects", "on top"] },
];

function ResumeMock() {
  return (
    <div className="relative h-full">
      <JkDocPreview width={143} height={227} highlight className="jk-wipe absolute left-[18px] top-[18px] rounded-[3px] bg-paper-warm" />
      <svg aria-hidden className="absolute inset-0 size-full text-bar-3" fill="none" stroke="currentColor" strokeWidth={0.9}>
        {CHANGES.map((c, i) => <line key={c.top} className="jk-pop" style={{ "--d": `${i * 0.5}s` } as React.CSSProperties} x1={161} y1={c.from} x2={170} y2={c.top + 23} />)}
      </svg>
      <ul>
        {CHANGES.map((c, i) => (
          <li key={c.lines[0]} style={{ top: c.top, "--d": `${i * 0.5}s` } as React.CSSProperties} className="jk-pop absolute left-[170px] flex h-[46px] w-[74px] flex-col items-center justify-center rounded-[10px] border border-bar-3 bg-card text-center">
            <span className="font-mono text-[7px] font-bold uppercase leading-[9px] tracking-[0.6px] text-bar-4-ink">Changed</span>
            <span className="mt-[2px] text-[9.5px] leading-[12px] text-foreground">{c.lines[0]}<br />{c.lines[1]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MOVES = ["Interested", "Applied", "Interviewing"];

function TrackMock() {
  return (
    <div className="h-full px-[18px] pt-[26px]">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9.5px] uppercase tracking-[1.6px] text-subtle-foreground">My Jobs</p>
        <p className="font-mono text-[10.5px] text-muted-foreground">236</p>
      </div>
      <JkStatusBar counts={SAMPLE_COUNTS} className="jk-grow -mt-[19px] [&>div:last-child]:h-[5px]" />
      <ul className="mt-[13px]">
        {SAMPLE_JOBS.map((j, i) => (
          <li key={j.title} className={cn("-mx-2 flex h-9 items-center gap-2.5 rounded-[9px] px-2", i === 0 ? "jk-lift bg-accent/70" : "border-t border-border first:border-0", i === 1 && "border-0")}>
            {i === 0 ? (
              // The top job moves through its statuses, as in the prototype.
              <>
                <span className="jk-sw size-[15px] shrink-0">{MOVES.map((st) => <JkStatusGlyph key={st} status={st} className="size-[15px]" />)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium leading-[14px] text-foreground">{j.title}</p>
                  <p className="jk-sw text-[9px] leading-[11px]">{MOVES.map((st) => <span key={st} className={STATUS_TEXT[statusKey(st)]}>{st}</span>)}</p>
                </div>
              </>
            ) : (
              <>
                <JkStatusGlyph status={j.status} className="size-[15px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium leading-[14px] text-foreground">{j.title}</p>
                  <p className={cn("text-[9px] leading-[11px]", STATUS_TEXT[statusKey(j.status)])}>{j.status}</p>
                </div>
              </>
            )}
            <span className="font-mono text-[9.5px] text-subtle-foreground">{j.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrepMock() {
  return (
    <div className="flex h-full flex-col px-[17px] pt-[22px]">
      <div className="h-[150px] [perspective:700px]">
        <div className="jk-flip relative h-full [transform-style:preserve-3d]">
          <div className="jk-face absolute inset-0 rounded-[14px] border border-input bg-card px-3.5 pt-[15px]">
            <p className="font-mono text-[9px] uppercase tracking-[1.3px] text-plan-text">Card 7 of 24 · Proof</p>
            <p className="mt-[13px] text-[14.5px] font-medium leading-5 text-foreground">Tell me about a time<br />you connected company<br />data to an LLM.</p>
            <p className="mt-[14px] border-t border-dashed border-input pt-[13px] font-mono text-[8.5px] uppercase tracking-[1.6px] text-subtle-foreground">Space to flip</p>
          </div>
          <div className="jk-face absolute inset-0 rounded-[14px] border border-plan bg-card px-3.5 pt-[15px] [transform:rotateX(180deg)]">
            <p className="font-mono text-[9px] uppercase tracking-[1.3px] text-plan-text">Answer, outcome first</p>
            <p className="mt-[11px] text-[11.5px] leading-[17px] text-muted-foreground">Lookups got over 60% faster after I built the internal AI platform: RAG over millions of records, three tools adopted company-wide.</p>
          </div>
        </div>
      </div>
      <div className="mt-[12px] flex gap-[7px]">
        {[["Reps", "bg-destructive"], ["Getting", "bg-warn"], ["Locked", "bg-ok"]].map(([l, c]) => (
          <span key={l} className={cn("inline-flex h-[26px] flex-1 items-center gap-1.5 rounded-full border border-input px-2.5 text-[10px] text-foreground", l === "Locked" && "jk-pick")}>
            <span className={cn("size-1.5 rounded-full", c)} />{l}
          </span>
        ))}
      </div>
      <div className="mt-[19px] flex gap-[3px]">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < 9 ? "bg-ok" : i < 15 ? "bg-warn" : "bg-border-strong", i === 9 && "jk-pip")} />
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Save the job", body: "Paste a link or use the Chrome extension. The full posting is saved.", mock: <SaveMock /> },
  { title: "Write the resume", body: "JobKompass reads the posting and writes a resume and cover letter for it.", mock: <ResumeMock /> },
  { title: "Track the status", body: "Each job carries its status, the resume you sent, and your notes.", mock: <TrackMock /> },
  { title: "Prep for the interview", body: "A prep deck built from the job: pitch, flashcards, and questions to ask.", mock: <PrepMock /> },
];

function StepCard({ step, i }: { step: (typeof STEPS)[number]; i: number }) {
  const ref = useOnScreen<HTMLLIElement>();
  const s = step;
  // Glow runs light to dark across the row: cyan, blue, violet, purple.
  const tone = (4 - i) as 1 | 2 | 3 | 4;
  return (
    <li ref={ref} style={{ "--tone": `var(--bar-${tone})` } as React.CSSProperties} className="jk-step jk-step-glow flex h-full flex-col rounded-[28px] border bg-card p-[10px] lg:h-[480px]">
      {/* The panel fills the card width (330 at 390, 262 at 1440) and the 262px mock scales with it. */}
                <div aria-hidden className="mx-auto aspect-square w-full overflow-hidden rounded-[22px] border border-border bg-background lg:max-w-[262px]">
                  {/* Scale the 262px mock to the panel at every width: four columns get narrower than 262 below ~1200px. */}
                  <JkScaleToFit base={262}>{s.mock}</JkScaleToFit>
                </div>
                <div className="px-3.5 pb-3.5 pt-[31px] lg:px-4 lg:pb-6 lg:pt-[25px]">
                  <p className="flex items-center gap-[9px] font-mono text-xs font-medium tracking-[1.2px] text-muted-foreground lg:tracking-normal">
                    <JkTick tone={tone} className="h-3.5 lg:hidden" />
                    <span className={cn("lg:hidden")}>0{i + 1}</span>
                    <span className={cn("hidden lg:inline", jkToneText(tone))}>0{i + 1}</span>
                  </p>
                  <h3 className="mt-[5px] text-[23px] font-medium leading-[27px] tracking-[-0.3px] text-foreground lg:mt-[9px] lg:text-[22px] lg:leading-[26px]">{s.title}</h3>
                  <p className="mt-[5px] text-[14.5px] leading-[22px] text-muted-foreground lg:mt-[11px] lg:text-[15px] lg:leading-[22.5px]">{s.body}</p>
                </div>
    </li>
  );
}

export default function JkLandingSteps() {
  return (
    <section id="product" className="scroll-mt-24 pb-14 pt-[61px] lg:pb-24 lg:pt-28" aria-labelledby="steps-heading">
      <LandingContainer>
        <SectionHeading id="steps-heading" title={<>Four steps from <br className="lg:hidden" />posting to interview</>} />
        <ol className="grid gap-4 min-[560px]:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06} className="h-full">
              <StepCard step={s} i={i} />
            </Reveal>
          ))}
        </ol>
      </LandingContainer>
    </section>
  );
}
