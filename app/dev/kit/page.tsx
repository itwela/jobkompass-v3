'use client'

import { notFound } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import { JOB_STATUSES } from "@/lib/jkStatus";
import JkArt from "@/app/jk-components/jkArt";
import { JkBars, JkEyebrow } from "@/app/jk-components/jkBars";
import JkStatusBar from "@/app/jk-components/jkStatusBar";
import JkStatusChip from "@/app/jk-components/jkStatusChip";
import JkCompanyLogo from "@/app/jk-components/jkCompanyLogo";
import JkPlanCards from "@/app/jk-components/jkPlanCards";
import JkDocPreview from "@/app/jk-components/jkDocPreview";
import JkPageHeader from "@/app/jk-components/jkPageHeader";

const COUNTS = [
  { status: "Interested", count: 150 }, { status: "Applied", count: 38 }, { status: "Callback", count: 3 },
  { status: "Interviewing", count: 2 }, { status: "Offered", count: 4 }, { status: "Rejected", count: 12 }, { status: "Ghosted", count: 27 },
];
const SWATCHES = ["bg-background", "bg-card", "bg-muted", "bg-accent", "bg-border", "bg-input", "bg-border-strong", "bg-primary", "bg-brand", "bg-plan", "bg-bar-1", "bg-bar-2", "bg-bar-3", "bg-bar-4", "bg-ok", "bg-warn", "bg-destructive"];

/** Dev-only reference: every primitive and shared jk component, in the current theme. */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const { theme, toggleTheme } = useJobKompassTheme();
  const [active, setActive] = useState<string | null>("Applied");
  return (
    <main className="mx-auto max-w-6xl space-y-14 px-6 py-12">
      <JkPageHeader title="v4 kit" sub={`Theme: ${theme}`} actions={<Button variant="secondary" onClick={toggleTheme}>Switch theme</Button>} />

      <section className="space-y-4">
        <JkEyebrow tone={1}>01 / Colour</JkEyebrow>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <div key={s} className="w-24">
              <div className={`h-12 rounded-lg border border-border-strong ${s}`} />
              <p className="mt-1 font-mono text-[10px] text-subtle-foreground">{s.replace("bg-", "")}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6"><JkBars size="sm" /><JkBars /><JkBars size="lg" /></div>
      </section>

      <section className="space-y-4">
        <JkEyebrow tone={2}>02 / Type</JkEyebrow>
        <h1 className="text-6xl font-medium tracking-tight">A tailored resume</h1>
        <h2 className="text-3xl font-medium">Four steps from posting to interview</h2>
        <p className="max-w-xl text-muted-foreground">Paste a posting. JobKompass saves the job, writes the resume and cover letter for it, and keeps your whole search in one list.</p>
        <p className="font-mono text-sm text-subtle-foreground">jk jobs add --company &quot;Anthropic&quot;</p>
      </section>

      <section className="space-y-4">
        <JkEyebrow tone={3}>03 / Controls</JkEyebrow>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Get started free</Button>
          <Button variant="plan">Start free trial</Button>
          <Button variant="secondary">See pricing</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete job</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex max-w-xl gap-3">
          <Input placeholder="Search title, company, notes, skills" />
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a job</DialogTitle><DialogDescription>Paste a link or the posting text.</DialogDescription></DialogHeader>
              <Input placeholder="careers.example.com/job/22417" />
              <Button>Save job</Button>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="space-y-4">
        <JkEyebrow tone={4}>04 / Status</JkEyebrow>
        <JkStatusBar counts={COUNTS} active={active} onSelect={setActive} />
        <div className="flex flex-wrap gap-x-6 gap-y-3">{JOB_STATUSES.map((s) => <JkStatusChip key={s} status={s} />)}</div>
        <div className="flex items-center gap-3">
          <JkCompanyLogo company="Northwind Labs" size="sm" /><JkCompanyLogo company="Parallel Works" /><JkCompanyLogo company="Anthropic" size="lg" />
        </div>
      </section>

      <section className="space-y-4">
        <JkEyebrow tone="plan">05 / Plans</JkEyebrow>
        <JkPlanCards current="plus" renderAction={(plan, { highlighted }) => <Button variant={highlighted ? "plan" : "secondary"} className="w-full">{plan.id === "free" ? "Get started" : "Start"}</Button>} />
      </section>

      <section className="space-y-4">
        <JkEyebrow tone={1}>06 / Documents and art</JkEyebrow>
        <div className="flex flex-wrap items-end gap-6">
          <JkDocPreview size="sm" /><JkDocPreview /><JkDocPreview kind="letter" /><JkDocPreview size="lg" />
        </div>
        <JkArt name="harbour" variant="band" />
        <div className="grid grid-cols-4 gap-4">
          {(["ship1", "ship2", "ship3", "ship4"] as const).map((n) => <JkArt key={n} name={n} variant="spot" />)}
        </div>
        <div className="relative h-80 overflow-hidden rounded-card border border-border">
          <JkArt name="hero" />
          <p className="relative p-8 text-2xl font-medium">Section art sits behind content</p>
        </div>
      </section>
    </main>
  );
}
