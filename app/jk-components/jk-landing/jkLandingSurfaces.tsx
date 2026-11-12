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
    <section aria-label="Where JobKompass works" className="relative z-10 -mt-10 lg:-mt-[110px]">
      <LandingContainer className="max-w-[1360px] px-5 sm:px-5">
        <Reveal className="rounded-[36px] border border-border-strong/80 bg-background px-6 py-9 sm:px-12 lg:h-[200px] lg:py-[38px]">
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
