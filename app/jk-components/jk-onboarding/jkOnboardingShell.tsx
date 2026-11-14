import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { mainAssets } from "@/app/lib/constants";
import JkArt, { type JkArtName } from "@/app/jk-components/jkArt";
import { cn } from "@/lib/utils";
import JkEnter from "@/app/jk-components/jkEnter";

export const ONBOARDING_STEPS = 3;

function Progress({ step, className, bar }: { step: number; className?: string; bar: string }) {
  return (
    <div className={cn("flex", className)} role="progressbar" aria-valuemin={1} aria-valuemax={ONBOARDING_STEPS} aria-valuenow={step} aria-label={`Step ${step} of ${ONBOARDING_STEPS}`}>
      {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
        <span key={i} className={cn("rounded-full transition-colors duration-500", bar, i < step ? "bg-plan" : "bg-input")} />
      ))}
    </div>
  );
}

/** Mono caps line used above every panel and list on these screens. */
export function JkOnbLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.14em] text-subtle-foreground lg:tracking-[0.16em]", className)}>{children}</p>;
}

/** Two-line headline and the line under it. */
export function JkOnbHeading({ lines, sub }: { lines: [string, string]; sub: React.ReactNode }) {
  return (
    <>
      <h1 className="text-[32px] font-medium leading-[38px] tracking-[-0.7px] lg:text-[40px] lg:leading-[46px] lg:tracking-[-0.9px]">
        {lines[0]}<br />{lines[1]}
      </h1>
      <p className="mt-2 max-w-[350px] text-[14.5px] leading-[22px] text-muted-foreground lg:mt-[11px] lg:max-w-[470px] lg:text-[15.5px] lg:leading-6">{sub}</p>
    </>
  );
}

/**
 * Onboarding frame (D21-D23, M22-M24). Desktop: header with logo, the three-step
 * bar and Skip; a painting band over the left column; a card-coloured panel on the
 * right. Phone: the band sits behind the back / bar / Skip row, content runs
 * below, and the main action is pinned to the bottom.
 */
export default function JkOnboardingShell({
  step,
  art,
  onBack,
  onSkip,
  aside,
  footnote,
  children,
}: {
  step: number;
  art: JkArtName;
  onBack?: () => void;
  onSkip: () => void;
  aside: React.ReactNode;
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Desktop header */}
      <header className="relative hidden h-[100px] items-center border-b border-border px-14 lg:flex">
        <Link href="/" className="flex items-center gap-2.5" aria-label="JobKompass home">
          <Image src={mainAssets.logo} alt="" width={32} height={30} className="h-[30px] w-[32px] object-contain" priority />
          <span className="text-[19px] font-bold tracking-[-0.01em]">JobKompass</span>
        </Link>
        <div className="absolute left-1/2 top-[46px] flex -translate-x-1/2 flex-col items-center gap-[17px]">
          <Progress step={step} bar="h-[5px] w-[100px]" className="gap-2.5" />
          <span className="font-mono text-[10px] font-medium uppercase leading-[13px] tracking-[0.16em] text-subtle-foreground">Step {step} of {ONBOARDING_STEPS}</span>
        </div>
        <button type="button" onClick={onSkip} className="ml-auto text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground">Skip for now</button>
      </header>

      <div className="lg:flex lg:min-h-[calc(100dvh-100px)]">
        <section className="relative flex min-w-0 flex-col pb-[120px] lg:w-[52.78%] lg:shrink-0 lg:pb-0">
          {/* Painting band: under the header row on phone, under the header bar on desktop. */}
          <div className="relative h-[200px] overflow-hidden lg:h-[196px]">
            <JkArt name={art} fade="none" live={art === "signal"} />
            <div aria-hidden className="absolute inset-0 bg-background/[0.18]" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[66%] bg-gradient-to-b from-transparent to-background lg:h-[76%]" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-background/70 to-transparent lg:hidden" />
          </div>

          {/* Phone header row over the band */}
          <div className="absolute inset-x-0 top-0 z-10 mx-auto flex h-[60px] max-w-[600px] items-center gap-3 px-5 lg:hidden">
            <button type="button" onClick={onBack} disabled={!onBack} aria-label="Back" className={cn("-ml-2 grid size-9 place-items-center text-foreground", !onBack && "invisible")}>
              <ChevronLeft className="size-5" strokeWidth={1.6} />
            </button>
            <Progress step={step} bar="h-1 flex-1" className="flex-1 gap-2 px-2" />
            <button type="button" onClick={onSkip} className="text-[14px] font-medium text-muted-foreground">Skip</button>
          </div>

          <div className="mx-auto -mt-1 w-full max-w-[600px] px-5 lg:mx-0 lg:-mt-[5px] lg:max-w-none lg:px-[clamp(40px,8.33vw,120px)]">
            <JkEnter />
            <div key={step} data-enter className="jk-stagger lg:max-w-[520px]">{children}</div>
          </div>
          {footnote && (
            <p className="mt-auto hidden px-[clamp(40px,8.33vw,120px)] pb-[53px] pt-10 font-mono text-[10px] uppercase leading-[13px] tracking-[0.12em] text-subtle-foreground lg:block">{footnote}</p>
          )}
        </section>

        <aside key={step} data-enter className="jk-stagger-aside hidden min-w-0 flex-1 border-l border-border bg-card px-10 pb-12 pt-[39px] lg:block">{aside}</aside>
      </div>

    </div>
  );
}
