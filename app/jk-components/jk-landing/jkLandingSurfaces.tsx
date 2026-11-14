import { JkTick } from "../jkBars";
import { LandingContainer, Reveal } from "./jkLandingShell";

// `short` is the phone copy from the M00 frame, where two columns leave less room.
const SURFACES = [
  { name: "Web app", note: "myjobkompass.com", short: "myjobkompass.com" },
  { name: "Chrome extension", note: "Save a job from any posting", short: "Save from any posting" },
  { name: "jk CLI", note: "Runs in your terminal", short: "Runs in your terminal" },
  { name: "AI agents", note: "Claude Code, Cursor, any agent", short: "Claude Code, Cursor" },
] as const;

export default function JkLandingSurfaces() {
  return (
    <section data-enter aria-label="Where JobKompass works" className="relative z-10 mt-2.5 lg:-mt-[110px]">
      <LandingContainer className="max-w-[1360px] px-5 sm:px-5">
        <Reveal className="rounded-[24px] px-5 pb-[26px] pt-5 lg:h-[200px] lg:rounded-[36px] lg:px-12 lg:py-[38px]">
          <p className="font-mono text-[9.5px] font-medium uppercase tracking-[1.4px] text-subtle-foreground lg:text-[0.6875rem] lg:font-normal lg:tracking-[0.14em]">Works where you work</p>
          <ul className="mt-[22px] grid grid-cols-2 gap-x-3 gap-y-[22px] min-[720px]:grid-cols-4 lg:mt-6 lg:gap-6">
            {SURFACES.map((s, i) => (
              <li key={s.name} style={{ "--i": i + 1 } as React.CSSProperties} className="jk-enter flex min-w-0 gap-[11px] lg:gap-3.5">
                <JkTick tone={(i + 1) as 1 | 2 | 3 | 4} className="mt-0.5 h-[34px] w-[3px] lg:h-11 lg:w-1" />
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium leading-5 text-foreground lg:text-xl">{s.name}</p>
                  <p className="text-[11.5px] leading-4 text-muted-foreground lg:hidden">{s.short}</p>
                  <p className="hidden text-sm text-muted-foreground lg:block">{s.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </LandingContainer>
    </section>
  );
}
