import { JkTick } from "../jkBars";
import { LandingContainer, Reveal } from "./jkLandingShell";

const SURFACES = [
  { name: "Web app", note: "myjobkompass.com" },
  { name: "Chrome extension", note: "Save a job from any posting" },
  { name: "jk CLI", note: "Runs in your terminal" },
  { name: "AI agents", note: "Claude Code, Cursor, any agent" },
] as const;

export default function JkLandingSurfaces() {
  return (
    <section aria-label="Where JobKompass works" className="relative z-10 -mt-32 sm:-mt-40">
      <LandingContainer className="max-w-[1352px]">
        <Reveal className="rounded-modal border border-border-strong bg-background/95 px-6 py-9 backdrop-blur sm:px-12">
          <p className="jk-eyebrow text-subtle-foreground">Works where you work</p>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SURFACES.map((s, i) => (
              <li key={s.name} className="flex gap-3.5">
                <JkTick tone={(i + 1) as 1 | 2 | 3 | 4} className="mt-0.5 h-11 w-1" />
                <div>
                  <p className="text-xl font-medium text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </LandingContainer>
    </section>
  );
}
