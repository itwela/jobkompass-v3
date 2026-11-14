import JkArt from "../jkArt";
import { CLI_AGENTS } from "./jkLandingAgents";
import { CLI_NOTES, CLI_STEPS } from "./jkLandingData";
import { LandingContainer, Reveal, SectionHeading } from "./jkLandingShell";

const SESSION: { kind: "cmd" | "ok" | "out"; text: string }[] = [
  { kind: "cmd", text: 'jk jobs add --company "Anthropic" \\\n    --title "Engineer" --status Interested' },
  { kind: "ok", text: "job added · k97f05pq" },
  { kind: "cmd", text: "jk resumes add --job-id k97f05pq" },
  { kind: "ok", text: "resume generated · Anthropic — Engineer.pdf" },
  { kind: "cmd", text: "jk jobs list --status Interested" },
  { kind: "out", text: "[ 1 job ] Anthropic · Engineer · Interested" },
];

// Phone session from M00: one line per command, short enough for 350px.
const PHONE_SESSION: { kind: "cmd" | "ok" | "out"; text: string }[] = [
  { kind: "cmd", text: '$ jk jobs add --company "Anthropic"' },
  { kind: "ok", text: "job added · k97f05pq" },
  { kind: "cmd", text: "$ jk resumes add --job-id k97f05pq" },
  { kind: "ok", text: "resume generated · Anthropic.pdf" },
  { kind: "cmd", text: "$ jk jobs list --status Interested" },
  { kind: "out", text: "[ 1 job ] Anthropic · Engineer" },
];

export default function JkLandingCli() {
  return (
    <section id="cli" className="relative isolate scroll-mt-24 overflow-hidden pb-[55px] lg:border-t lg:border-border lg:bg-card/60 lg:py-28" aria-labelledby="cli-heading">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[40%] opacity-45 lg:block"><JkArt name="signal" fade="left" live /></div>
      <LandingContainer>
        <SectionHeading id="cli-heading" title={<>Let your AI agent <br className="lg:hidden" />run your job search</>} lead="Your coding agent can already read a posting and write a resume. The jk CLI lets it save the result to your account." leadAlways className="mb-6 lg:mb-8" />
        <AgentRow />
        <Reveal className="lg:hidden">
          <div aria-hidden className="h-[214px] overflow-hidden rounded-[22px] border border-input bg-terminal px-5 pt-[18px]">
            <div className="flex gap-[7px]">
              <span className="size-[9px] rounded-full bg-destructive" /><span className="size-[9px] rounded-full bg-warn" /><span className="size-[9px] rounded-full bg-ok" />
            </div>
            <div className="mt-[14px] space-y-[8.5px] whitespace-nowrap font-mono text-[11.5px] leading-[16.5px] max-[359px]:text-[10px]">
              {PHONE_SESSION.map((l) => (
                <p key={l.text} className={l.kind === "cmd" ? "text-foreground" : l.kind === "ok" ? "text-ok" : "text-bar-4-ink"}>{l.text}</p>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal className="lg:hidden">
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {CLI_STEPS.map((step, i) => (
              <li key={step.label} className="flex gap-4 py-4">
                <span className="font-mono text-xs leading-7 text-bar-4-ink">0{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium tracking-tight text-foreground">{step.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <div className="hidden gap-8 lg:grid lg:grid-cols-[1.45fr_1fr] lg:gap-12">
          <Reveal>
            <div aria-hidden className="h-full overflow-hidden rounded-modal border border-border-strong/70 bg-background">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
                <span className="size-2 rounded-full bg-destructive" /><span className="size-2 rounded-full bg-warn" /><span className="size-2 rounded-full bg-ok" />
                <span className="ml-4 font-mono text-xs text-subtle-foreground">~/job-search</span>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-7">
                {SESSION.map((l, i) => (
                  <div key={i} className={l.kind === "cmd" && i > 0 ? "mt-3" : undefined}>
                    <span className="mr-3 inline-block w-3 text-subtle-foreground">{l.kind === "cmd" ? "$" : l.kind === "ok" ? "✓" : ""}</span>
                    <span className={l.kind === "cmd" ? "text-foreground" : l.kind === "ok" ? "text-ok" : "text-bar-4-ink"}>{l.text}</span>
                  </div>
                ))}
              </pre>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <ol className="divide-y divide-border border-y border-border">
              {CLI_STEPS.map((step, i) => (
                <li key={step.label} className="flex gap-6 py-6">
                  <span className="font-mono text-xs leading-8 text-bar-4-ink">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-medium tracking-tight text-foreground">{step.label}</p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{step.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
        <Reveal className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-3 lg:mt-12 lg:gap-8 lg:pt-8 sm:divide-x sm:divide-border [&>div:not(:first-child)]:sm:pl-8">
          {CLI_NOTES.map((n) => (
            <div key={n.title}>
              <p className="text-lg font-medium text-foreground">{n.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </Reveal>
      </LandingContainer>
    </section>
  );
}

/** The agents the CLI plugs into, so the section reads at a glance on every width. */
function AgentRow() {
  return (
    <Reveal className="mb-8 lg:mb-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">Works with any agent that can run a command</p>
      <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:flex lg:flex-wrap lg:gap-3">
        {CLI_AGENTS.map((a) => (
          <li key={a.name}>
            <a href={a.href} target="_blank" rel="noopener noreferrer" data-tone={a.tone} className="jk-agent flex h-full cursor-pointer flex-col items-center gap-2 rounded-2xl border border-border bg-background/70 px-2 py-3.5 transition-colors hover:border-border-strong lg:flex-row lg:gap-2.5 lg:px-4 lg:py-2.5">
              <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-current transition-colors lg:size-5"><path d={a.path} /></svg>
              <span className="text-center text-xs font-medium text-muted-foreground transition-colors lg:text-sm">{a.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
