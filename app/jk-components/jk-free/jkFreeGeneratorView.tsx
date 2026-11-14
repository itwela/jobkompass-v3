'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Download, Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Template } from "@/lib/templates";
import JkPublicHeader from "../jkPublicHeader";
import JkFooter from "../jkFooter";
import JkEnter from "../jkEnter";
import JkArt from "../jkArt";
import JkDocPreview from "../jkDocPreview";
import { JkEyebrow, JkTick } from "../jkBars";
import { DotCounter } from "../jk-landing/jkLandingFreeGenerator";

export type FreeStep = 1 | 2 | 3;

const STEPS = ["Paste or upload", "Pick a template", "Download"] as const;

// The sample in the D19/M20 frames, shown as the empty-field placeholder.
const SAMPLE = [
  "Itwela Ibomu",
  "Remote, US · itwela@email.com · github.com/itwela",
  "",
  "Founder and Software Engineer, JobKompass, 2024 - Present",
  "- Built an MCP server that lets agents read and write job records",
  "- Used Claude Code to ship features end to end",
  "- Designed a RAG pipeline in Python",
].join("\n");

export interface FreeGeneratorViewProps {
  step: FreeStep;
  onStep: (s: FreeStep) => void;
  resumeText: string;
  onResumeText: (v: string) => void;
  pdfName: string | null;
  onPdfFile: (f: File) => void;
  onClearPdf: () => void;
  promptText: string;
  onPromptText: (v: string) => void;
  freeTemplates: Template[];
  lockedTemplates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onLockedTemplate: (name: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  pdfBase64: string | null;
  onDownload: (b64?: string) => void;
  downloads: { id: string; templateName: string; pdfBase64: string }[];
  storedEmail: string | null;
  /** Called when "Pick a template" is pressed with nothing pasted or uploaded. */
  onNeedInput: () => void;
}

/** "JobKompass Jake" -> "Jake", the name the frames use. */
const stripBrand = (name: string) => name.replace(/^JobKompass\s+/i, "");
const shortName = (t: Template | null) => (t ? stripBrand(t.name) : "Jake");

/** Tick, number and label for one step, as in D19 (row) and M20 (bar above). */
function StepRail({ step, onStep, canPick }: { step: FreeStep; onStep: (s: FreeStep) => void; canPick: boolean }) {
  return (
    <ol className="grid grid-cols-3 gap-2 border-b border-border px-5 pb-[19px] pt-6 md:flex md:gap-0 md:px-8 md:pb-[23px] md:pt-[30px]">
      {STEPS.map((label, i) => {
        const n = (i + 1) as FreeStep;
        const on = n === step;
        // A step you've already passed can be revisited; later ones open through the button.
        const reachable = n < step || (n === 2 && canPick && step !== 2);
        const inner = (
          <>
            {/* Phone: a bar across the column. Desktop: a 3x14 tick. */}
            <span aria-hidden className={cn("block h-[3px] w-full rounded-full md:hidden", n <= step ? "bg-bar-1" : "bg-input")} />
            <JkTick tone={1} className={cn("hidden md:inline-block", n > step && "bg-input", n < step && "bg-bar-1/50")} />
            <span className={cn("mt-[11px] block font-mono text-[10px] tracking-[0.6px] md:ml-[11px] md:mt-0 md:text-[11px] md:tracking-[1.2px]", on ? "text-plan" : "text-subtle-foreground")}>0{n}</span>
            <span className={cn("mt-[3px] block whitespace-nowrap text-[12.5px] md:ml-[11px] md:mt-0 md:text-sm", on ? "font-medium text-foreground" : n < step ? "text-muted-foreground" : "text-subtle-foreground")}>{label}</span>
          </>
        );
        return (
          <li key={label} aria-current={on ? "step" : undefined} className="md:w-[190px]">
            {reachable ? (
              <button type="button" onClick={() => onStep(n)} className="w-full text-left transition-opacity hover:opacity-80 md:flex md:items-center">{inner}</button>
            ) : (
              <div className="md:flex md:items-center">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Dashed drop target for a PDF; also opens the file picker. */
function PdfDrop({ pdfName, onPdfFile, onClearPdf }: Pick<FreeGeneratorViewProps, "pdfName" | "onPdfFile" | "onClearPdf">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const icon = (
    <svg aria-hidden viewBox="0 0 12 17" className="h-[17px] w-3 shrink-0 text-bar-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M1 1.2h6.2L11 5v10.8H1z" /><path d="M7 1.2V5h4" />
    </svg>
  );
  if (pdfName) {
    return (
      <div className="flex h-[76px] items-center gap-[19px] rounded-2xl border border-border-strong px-6 md:h-[78px] md:px-7">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-foreground">{pdfName}</p>
          <p className="text-[12.5px] text-subtle-foreground">PDF ready. Your text box is cleared.</p>
        </div>
        <button type="button" onClick={onClearPdf} aria-label="Remove PDF" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onPdfFile(f); }}
      className={cn("flex h-[76px] w-full items-center gap-[19px] rounded-2xl border border-dashed px-6 text-left transition-colors md:h-[78px] md:px-7", over ? "border-bar-3 bg-bar-3/5" : "border-border-strong hover:border-muted-foreground/60")}
    >
      {icon}
      <span>
        <span className="block text-[15px] font-medium text-foreground"><span className="md:hidden">Upload a PDF</span><span className="hidden md:inline">Drop a PDF here</span></span>
        <span className="mt-0.5 block text-[12.5px] text-subtle-foreground"><span className="md:hidden">Choose a file · up to 5 MB</span><span className="hidden md:inline">or choose a file · up to 5 MB</span></span>
      </span>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdfFile(f); e.target.value = ""; }} />
    </button>
  );
}

/** Cream primary action, the frame's 180x46 (desktop) / full-width 50 (phone) pill. */
function CreamButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button size="lg" {...props} className={cn("jk-fx jk-fx-cream h-[50px] w-full rounded-full text-[15.5px] md:h-[46px] md:w-auto md:px-[38px] md:text-[15px]", className)} />;
}

/** One template choice: its real preview page, name, and a lock for paid ones. */
function TemplateTile({ t, selected, locked, onClick }: { t: Template; selected?: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={locked ? undefined : selected}
      className={cn("group flex flex-col overflow-hidden rounded-2xl border text-left transition-colors", selected ? "border-bar-3" : "border-input hover:border-border-strong", locked && "cursor-not-allowed")}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-paper">
        <Image src={t.previewImage} alt={`${t.name} template`} fill sizes="200px" className={cn("object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]", locked && "opacity-60")} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
        <span className="truncate text-sm font-medium text-foreground">{shortName(t)}</span>
        {locked ? (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[9.5px] uppercase tracking-[1.2px] text-plan"><Lock className="size-3" />Paid</span>
        ) : (
          <span className={cn("font-mono text-[9.5px] uppercase tracking-[1.2px]", selected ? "text-bar-3" : "text-subtle-foreground")}>{selected ? "Picked" : "Free"}</span>
        )}
      </div>
    </button>
  );
}

/** The generated PDF, shown inline from a blob URL (data: URLs are blocked in iframes). */
function PdfFrame({ b64 }: { b64: string }) {
  const url = useMemo(() => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  }, [b64]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <iframe src={`${url}#toolbar=0&view=FitH`} title="Your resume" className="size-full rounded-[4px] bg-paper" />;
}

export default function JkFreeGeneratorView(p: FreeGeneratorViewProps) {
  const stats = useQuery(api.freeResumeStats.getStats);
  const total = stats?.totalGenerations ?? 0;
  const hasInput = Boolean(p.resumeText.trim() || p.pdfName);
  const selected = p.freeTemplates.find((t) => t.id === p.selectedTemplateId) ?? null;
  const [showPrompt, setShowPrompt] = useState(Boolean(p.promptText));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JkEnter />
      <JkPublicHeader showPricing showNav overlay />
      <main className="relative isolate flex-1">
        {/* Painted sea under the cards, fading up into the page (D19: from 560 on a 1000 frame). */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px] lg:h-[440px]">
          <JkArt name="waves" fade="y" live />
          {/* As on D18: page colour at 30% over the painting keeps it quiet under the cards. */}
          <div className="absolute inset-0 bg-background/30" />
        </div>

        <section data-enter aria-labelledby="free-heading" className="mx-auto max-w-[1248px] px-5 pb-[140px] pt-[141px] sm:px-6 lg:pb-[110px] lg:pt-[167px]">
          <JkEyebrow tone={4} className="jk-enter text-muted-foreground">Free resume generator</JkEyebrow>
          <h1 id="free-heading" style={{ "--i": 0 } as React.CSSProperties} className="jk-enter mt-[13px] text-[38px] font-medium leading-[44px] tracking-[-0.9px] text-foreground max-[359px]:text-[33px] max-[359px]:leading-[39px] sm:text-[48px] sm:leading-[56px] lg:mt-2.5 lg:text-[60px] lg:leading-[72px] lg:tracking-[-1.6px]">
            Try us without <br className="sm:hidden" />signing up
          </h1>
          <p style={{ "--i": 1 } as React.CSSProperties} className="jk-enter mt-3 max-w-[350px] text-[15px] leading-[22px] text-muted-foreground sm:max-w-none lg:mt-1.5 lg:text-[17px]">
            Paste your resume text or upload a PDF. Pick a template. Download the PDF.
          </p>

          {/* Stacked to 1100px, then the frame's 620 / 520 columns with the gap between. */}
          <div className="mt-[38px] grid gap-4 lg:mt-[42px] min-[1100px]:grid-cols-[minmax(0,620fr)_minmax(0,520fr)] min-[1100px]:gap-[60px]">
            {/* Left: the three steps. */}
            <div style={{ "--i": 2 } as React.CSSProperties} className="jk-enter flex flex-col rounded-[28px] border border-input bg-card min-[1100px]:min-h-[560px]">
              <StepRail step={p.step} onStep={p.onStep} canPick={hasInput} />

              <div className="flex flex-1 flex-col px-5 pb-6 pt-5 md:px-8 md:pb-10 md:pt-7">
                {p.step === 1 && (
                  <>
                    <label className="relative block rounded-2xl border border-input bg-background focus-within:border-border-strong">
                      <span className="block px-4 pt-[17px] font-mono text-[9px] font-medium uppercase tracking-[1.2px] text-subtle-foreground md:sr-only">Your resume text</span>
                      {/* Phone: typed at 16px so iOS doesn't zoom on focus, drawn at M20's 11.5px by scaling. */}
                      <div className="h-[176px] overflow-hidden md:h-auto">
                      <textarea
                        value={p.resumeText}
                        onChange={(e) => p.onResumeText(e.target.value)}
                        disabled={Boolean(p.pdfName)}
                        placeholder={p.pdfName ? "Using your PDF. Remove it to paste text instead." : SAMPLE}
                        spellCheck={false}
                        className="block h-[245px] w-[139.13%] origin-top-left scale-[0.71875] resize-none bg-transparent px-[22px] pb-4 pt-[11px] font-mono text-[16px] leading-[27.8px] text-muted-foreground caret-plan outline-none placeholder:text-muted-foreground/70 disabled:opacity-60 md:h-[248px] md:w-full md:scale-100 md:px-[18px] md:pt-4 md:text-[12.5px] md:leading-[22px]"
                      />
                      </div>
                    </label>
                    <div className="mt-4"><PdfDrop pdfName={p.pdfName} onPdfFile={p.onPdfFile} onClearPdf={p.onClearPdf} /></div>
                    <div className="mt-6 flex flex-col items-center gap-[13px] md:mt-auto md:flex-row md:gap-5 md:pt-[34px]">
                      <CreamButton onClick={() => (hasInput ? p.onStep(2) : p.onNeedInput())}>Pick a template</CreamButton>
                      <span className="text-[13.5px] text-muted-foreground">No account. No card.</span>
                    </div>
                  </>
                )}

                {p.step === 2 && (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {p.freeTemplates.map((t) => <TemplateTile key={t.id} t={t} selected={t.id === p.selectedTemplateId} onClick={() => p.onSelectTemplate(t.id)} />)}
                      {p.lockedTemplates.map((t) => <TemplateTile key={t.id} t={t} locked onClick={() => p.onLockedTemplate(t.name)} />)}
                    </div>
                    {p.pdfName ? null : showPrompt ? (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-4">
                          <input
                            value={p.promptText}
                            onChange={(e) => p.onPromptText(e.target.value)}
                            placeholder="e.g. lead with leadership, tighten the wording"
                            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
                          />
                          <button type="button" aria-label="Remove instructions" onClick={() => { setShowPrompt(false); p.onPromptText(""); }} className="text-subtle-foreground hover:text-foreground"><X className="size-4" /></button>
                        </div>
                        <p className="mt-2 text-xs text-subtle-foreground">Instructions change wording and emphasis only. They can&apos;t add jobs, employers or numbers.</p>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowPrompt(true)} className="mt-4 self-start text-[13.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Add instructions</button>
                    )}
                    <div className="mt-6 flex flex-col items-center gap-[13px] md:mt-auto md:flex-row md:gap-5 md:pt-[34px]">
                      <CreamButton disabled={!selected || p.isGenerating} onClick={p.onGenerate}>
                        {p.isGenerating ? <><Loader2 className="size-4 animate-spin" />Making your resume</> : "Make my resume"}
                      </CreamButton>
                      <button type="button" onClick={() => p.onStep(1)} className="text-[13.5px] text-muted-foreground hover:text-foreground">Back to your text</button>
                    </div>
                  </>
                )}

                {p.step === 3 && (
                  <>
                    {p.isGenerating ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin" />
                        <p className="text-sm">Making your resume in the {shortName(selected)} template</p>
                      </div>
                    ) : p.pdfBase64 ? (
                      <>
                        <p className="text-[22px] font-medium tracking-[-0.3px] text-foreground md:text-[26px]">Your resume is ready</p>
                        <p className="mt-1.5 text-[14.5px] text-muted-foreground">One page in the {shortName(selected)} template.</p>

                        {/* Every file made this visit, newest first. */}
                        <ul className="mt-6 space-y-2">
                          {[...p.downloads].reverse().map((d, i) => (
                            <li key={d.id}>
                              <button
                                type="button"
                                onClick={() => p.onDownload(d.pdfBase64)}
                                className="group flex w-full items-center gap-4 rounded-2xl border border-input bg-background/60 px-4 py-3 text-left transition-colors hover:border-border-strong"
                              >
                                <span className="grid h-11 w-9 shrink-0 place-items-center rounded-[3px] bg-paper font-mono text-[8px] font-medium tracking-[0.8px] text-paper-foreground">PDF</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[14.5px] font-medium text-foreground">resume-{stripBrand(d.templateName).toLowerCase().replace(/\s+/g, "-")}.pdf</span>
                                  <span className="mt-0.5 block text-[12.5px] text-subtle-foreground">{stripBrand(d.templateName)} template{i === 0 ? " · just now" : ""}</span>
                                </span>
                                <Download className="size-4 shrink-0 text-subtle-foreground transition-colors group-hover:text-foreground" />
                              </button>
                            </li>
                          ))}
                        </ul>

                        {/* What an account adds. Fills the card with the next honest step. */}
                        <div className="mt-8 border-t border-border pt-6">
                          <p className="font-mono text-[10px] font-medium uppercase tracking-[1.6px] text-subtle-foreground">With an account</p>
                          <ul className="mt-4 space-y-3">
                            {[
                              { tone: 1, text: "A tailored resume for every job you apply to" },
                              { tone: 2, text: "Cover letters written from your real experience" },
                              { tone: 3, text: "One place to track every application" },
                            ].map((r) => (
                              <li key={r.text} className="flex items-center gap-3 text-[14px] text-muted-foreground">
                                <JkTick tone={r.tone as 1 | 2 | 3} />
                                {r.text}
                              </li>
                            ))}
                          </ul>
                          <a href="/auth" className="mt-5 inline-block text-[13.5px] font-medium text-foreground underline-offset-4 hover:underline">Make an account</a>
                        </div>
                        <div className="mt-6 flex flex-col items-center gap-[13px] md:mt-auto md:flex-row md:gap-5 md:pt-[34px]">
                          <CreamButton onClick={() => p.onDownload()}><Download className="size-4" />Download PDF</CreamButton>
                          <button type="button" onClick={() => p.onStep(2)} className="text-[13.5px] text-muted-foreground hover:text-foreground">Try another template</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
                        <p className="text-sm text-muted-foreground">That one didn&apos;t come through.</p>
                        <CreamButton onClick={p.onGenerate}>Try again</CreamButton>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: what you get, then your actual PDF once it's made. */}
            <div style={{ "--i": 3 } as React.CSSProperties} className="jk-enter flex flex-col rounded-[28px] border border-input bg-popover px-5 pb-[23px] pt-[29px] md:px-8 md:pt-[31px] min-[1100px]:min-h-[560px]">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[1.6px] text-subtle-foreground">{p.pdfBase64 && p.step === 3 ? "Your resume" : "What you get"}</p>
              <div className="mx-auto mt-5 flex w-full justify-center md:mt-6">
                {p.pdfBase64 && p.step === 3 ? (
                  <div className="h-[293px] w-[220px] md:h-[400px] md:w-[300px]"><PdfFrame b64={p.pdfBase64} /></div>
                ) : selected && selected.id !== "jake" && p.step >= 2 ? (
                  <div className="relative h-[293px] w-[220px] overflow-hidden rounded-[4px] bg-paper md:h-[400px] md:w-[300px]"><Image src={selected.previewImage} alt="" fill sizes="300px" className="object-cover object-top" /></div>
                ) : (
                  <>
                    <JkDocPreview width={220} height={293} className="rounded-[4px] bg-paper-warm shadow-none md:hidden" />
                    <JkDocPreview width={300} height={400} className="hidden rounded-[4px] bg-paper-warm shadow-none md:block" />
                  </>
                )}
              </div>
              <div className="mt-[25px] flex flex-col md:mt-auto md:flex-row md:items-end md:justify-between md:gap-6 md:pt-7">
                <div>
                  <p className="text-[15px] font-medium text-foreground">A one-page PDF in the {shortName(selected)} template</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">Unlimited edits before you export.</p>
                </div>
                {total > 0 && (
                  <div className="mt-[21px] flex items-center gap-6 border-t border-border pt-[15px] md:mt-0 md:block md:border-0 md:pt-0">
                    <DotCounter value={total} small />
                    <p className="max-w-[140px] font-mono text-[8.5px] uppercase leading-[14px] tracking-[1.2px] text-subtle-foreground md:mt-1.5 md:max-w-none md:text-right">
                      <span className="md:hidden">Resumes made with the free generator so far</span>
                      <span className="hidden md:inline">Made so far</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <JkFooter />
    </div>
  );
}
