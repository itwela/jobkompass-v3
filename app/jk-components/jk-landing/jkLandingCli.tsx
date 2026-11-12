import JkArt from "../jkArt";
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

export default function JkLandingCli() {
  return (
    <section id="cli" className="relative isolate scroll-mt-24 overflow-hidden border-t border-border bg-card/60 py-20 sm:py-28" aria-labelledby="cli-heading">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[31%] opacity-45 lg:block"><JkArt name="signal" position="right top" /></div>
      <LandingContainer>
        <SectionHeading id="cli-heading" eyebrow="04 / Command line" tone={4} title="Let your AI agent run your job search" lead="Your coding agent can already read a posting and write a resume. The jk CLI lets it save the result to your account." />
        <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-12">
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
                    <span className={l.kind === "cmd" ? "text-foreground" : l.kind === "ok" ? "text-ok" : "text-bar-4"}>{l.text}</span>
                  </div>
                ))}
              </pre>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <ol className="divide-y divide-border border-y border-border">
              {CLI_STEPS.map((step, i) => (
                <li key={step.label} className="flex gap-6 py-6">
                  <span className="font-mono text-xs leading-8 text-bar-4">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-medium tracking-tight text-foreground">{step.label}</p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{step.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
        <Reveal className="mt-12 grid gap-8 border-t border-border pt-8 sm:grid-cols-3 sm:divide-x sm:divide-border [&>div:not(:first-child)]:sm:pl-8">
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
