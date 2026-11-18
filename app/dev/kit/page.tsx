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
import JkResumePage from "@/app/jk-components/jk-onboarding/jkResumePage";
import { JkJobLogo } from "@/app/jk-components/jk-jobs/jkJobBits";
import type { ResumeContent } from "@/lib/resume/types";
import { JkSeesFinding } from "@/app/jk-components/jk-chatwindow-components/jkChatWindow-PerformanceMode";
import { JkJobsPhoneList } from "@/app/jk-components/jk-chatwindow-components/jkJobsGrid";
import { JkGauge } from "@/app/jk-components/jk-performance/jkCharts";
import { JkHelpVisual } from "@/app/jk-components/jk-chatwindow-components/jkChatWindow-HelpMode";
import { JkAppMobileMenu, JkAppTabBar } from "@/app/jk-components/jk-app/jkAppMobile";

const SAMPLE_FINDINGS = [
  { headline: "Most applications went quiet.", evidence: "Only 14 of the 137 reached an interview, so follow up a week after applying.", count: 80, total: 137 },
  { headline: "A lot of saved jobs are still waiting.", evidence: "Pick the five closest to your resume and apply this week.", count: 99, total: 236 },
  { headline: "Friday applications did best.", evidence: "2 of your offers came from the 18 sent on a Friday." },
];
const SAMPLE_JOBS = [
  { _id: "a", title: "GTM AI Solutions Engineer", company: "Stripe", status: "Interviewing", link: "https://stripe.com/jobs/1", compensation: "$120k" },
  { _id: "b", title: "Forward Deployed Engineer (Remote, US Time Zones)", company: "Speedy Labs", status: "Interested" },
  { _id: "c", title: "Frontend Engineer", company: "Evil Martians", status: "Applied", link: "https://evilmartians.com/jobs", compensation: "$150k" },
] as any[];

const SAMPLE_RESUME = {
  personalInfo: { firstName: "Jordan", lastName: "Avery", email: "jordan@example.com", phone: "(555) 014-2870", location: "Atlanta, GA", linkedin: "linkedin.com/in/jordan-avery", summary: "Software developer who builds internal tools for logistics teams, from the driver app API to the dispatch dashboard." },
  skills: { technical: ["Python", "FastAPI", "React", "PostgreSQL"], additional: ["Agile", "Technical writing"] },
  experience: [
    { company: "Northgate Logistics", title: "Software Developer", date: "Mar 2024 - Present", location: "Atlanta, GA", details: ["Built a React dashboard that dispatchers use to assign 1,200 daily deliveries", "Built the backend API for the driver mobile app in Python and FastAPI"] },
    { company: "Peachtree Dental Group", title: "IT Support Specialist", date: "Jun 2022 - Feb 2024", location: "Atlanta, GA", details: ["Wrote Python scripts that send patient appointment reminder emails"] },
  ],
  education: [{ name: "State University", degree: "B.S. Computer Science", startDate: "2018", endDate: "2022" }],
  projects: [{ name: "BudgetBuddy", description: "Personal finance tracker", details: ["Tracks spending across accounts with login and charts"] }],
  certifications: [{ name: "Solutions Architect Associate", issuer: "AWS", date: "Jan 2026" }],
} as unknown as ResumeContent;

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
  const [menu, setMenu] = useState(false);
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
      <section id="resume-templates" className="space-y-4">
        <JkEyebrow>Resume page by template</JkEyebrow>
        <div className="flex flex-wrap items-start gap-6">
          {([undefined, "jake", "joseph", "mar"] as const).map((t) => (
            <div key={t ?? "plain"} className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">{t ?? "no template"}</p>
              <JkResumePage content={SAMPLE_RESUME} template={t} width={420} height="auto" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <JkJobLogo company="Stripe" link="https://stripe.com/jobs/1" size={24} /><JkJobLogo company="Speedy Labs" size={24} /><JkJobLogo company="Evil Martians" link="https://evilmartians.com/jobs" size={32} />
        </div>
      </section>
      <section id="sees" className="space-y-4">
        <JkEyebrow>What JobKompass sees: findings</JkEyebrow>
        <div className="rounded-3xl border border-input bg-card p-6">
          <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            {SAMPLE_FINDINGS.map((it, i) => <JkSeesFinding key={i} item={it} color={["var(--bar-2)", "var(--bar-3)", "var(--bar-4)"][i]} />)}
          </div>
        </div>
      </section>
      <section id="phone-jobs" className="max-w-[420px] space-y-4">
        <JkEyebrow>Phone job rows and tab bar</JkEyebrow>
        <JkJobsPhoneList jobs={SAMPLE_JOBS} total={3} selectionMode={false} selectedIds={[]} onOpen={() => {}} onToggle={() => {}} />
      </section>
      <section id="rate" className="space-y-4">
        <JkEyebrow>Interview rate block at column widths</JkEyebrow>
        {[300, 340, 396, 520].map((w) => ["100", "12.5", "8"].map((n) => (
          <div key={`${w}${n}`} className="@container overflow-hidden border border-dashed border-border" style={{ width: w }}>
            <div className="flex items-end justify-start gap-[clamp(12px,6cqw,48px)]">
              <p className="flex min-w-0 items-baseline whitespace-nowrap text-foreground">
                <span className="font-medium leading-[1.19] tracking-[-0.035em]" style={{ fontSize: `clamp(56px, ${n.length > 3 ? 16 : n.length > 2 ? 20 : 26}cqw, 112px)` }}>{n}</span>
                <span className="ml-2.5 text-[44px] font-medium text-subtle-foreground">%</span>
              </p>
              <JkGauge value={Number(n)} previous={0} previousLabel="OCT" className="mb-6 h-auto w-[clamp(116px,36cqw,158px)] shrink-0" />
            </div>
          </div>
        )))}
      </section>
      <section id="help-visual" className="space-y-4">
        <JkEyebrow>Help: what you get</JkEyebrow>
        <div className="flex flex-wrap gap-6">
          <div className="w-[340px]"><JkHelpVisual kind="tailored" /></div>
          <div className="w-[340px]"><JkHelpVisual kind="resume" /></div>
        </div>
      </section>
      <JkAppTabBar onMore={() => setMenu(true)} moreOpen={menu} />
      <JkAppMobileMenu open={menu} onClose={() => setMenu(false)} />
    </main>
  );
}
