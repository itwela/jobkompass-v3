import Image from "next/image";
import Link from "next/link";
import { mainAssets } from "@/app/lib/constants";
import JkArt from "@/app/jk-components/jkArt";
import { cn } from "@/lib/utils";
import JkEnter from "@/app/jk-components/jkEnter";

/**
 * Sign in / sign up / reset (D17, D20, M12, M21).
 * Desktop: the live harbour painting fills the left 760/1440 and dissolves into
 * the page on its right; the form sits 120px past it. Phone: the painting is a
 * band across the top and the form runs below it.
 */
export default function JkAuthShell({
  band = "short",
  children,
  className,
  enterKey,
}: {
  /** Change it (e.g. sign in ⇄ sign up) to replay the form's entrance without remounting the painting. */
  enterKey?: string;
  /** Phone band height: "short" (236, sign up) or "tall" (330, sign in). */
  band?: "short" | "tall";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative min-h-dvh bg-background text-foreground lg:flex">
      <div
        className={cn(
          "jk-auth-art relative w-full overflow-hidden lg:sticky lg:top-0 lg:h-dvh lg:w-[52.78%] lg:shrink-0",
          band === "tall" ? "h-[330px]" : "h-[236px]",
        )}
      >
        {/* Phone band keeps the scene's own crop (lighthouse to buoys); the tall desktop panel is cropped from the centre, as the frame is. */}
        <JkArt name="harbour" live fade="none" className="lg:hidden" />
        <JkArt name="harbour" live fade="none" focus={[0.5, 1]} className="hidden lg:block" />
        {/* Desktop: dissolve into the page on the right, darken under the logo. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[39.5%] bg-gradient-to-r from-transparent to-background lg:block" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[150px] bg-gradient-to-b from-background/70 to-transparent lg:h-[200px]" />
        {/* Phone: dissolve into the form below. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-b from-transparent to-background lg:hidden" />
        <Link href="/" className="absolute left-5 top-6 z-10 flex items-center gap-2 lg:left-14 lg:top-11 lg:gap-2.5" aria-label="JobKompass home">
          <Image src={mainAssets.logo} alt="" width={34} height={32} className="h-[30px] w-[32px] object-contain lg:h-[32px] lg:w-[34px]" priority />
          <span className="text-[20px] font-bold tracking-[-0.01em] text-foreground">JobKompass</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-dvh">
        <main
          className={cn(
            "mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pt-[21px] lg:max-w-none lg:items-center lg:justify-center lg:px-10 lg:py-16",
            className,
          )}
        >
          <JkEnter />
          <div key={enterKey} data-enter className="w-full lg:max-w-[400px]">{children}</div>
        </main>
        <p className="px-5 pb-8 pt-10 text-center font-mono text-[8px] uppercase leading-[11px] tracking-[0.06em] text-subtle-foreground lg:mx-auto lg:w-[400px] lg:px-0 lg:pb-[45px] lg:pt-0 lg:text-left lg:text-[9.5px] lg:leading-[13px] lg:tracking-[0.126em]">
          By continuing you agree to the{" "}
          <Link href="/terms" className="transition-colors hover:text-foreground">terms</Link> and{" "}
          <Link href="/privacy" className="transition-colors hover:text-foreground">privacy policy</Link>
        </p>
      </div>
    </div>
  );
}

/** Gold tick + mono caps line, then the headline and one line under it. */
export function JkAuthHeading({ eyebrow, title, sub, subClassName }: { eyebrow: string; title: string; sub?: string; subClassName?: string }) {
  return (
    <div>
      <p style={{ "--i": 0 } as React.CSSProperties} className="jk-enter flex items-center gap-[11px] font-mono text-[11px] uppercase leading-[15px] tracking-[0.127em] text-muted-foreground">
        <span aria-hidden className="h-[14px] w-[3px] shrink-0 rounded-full bg-plan" />
        {eyebrow}
      </p>
      <h1 style={{ "--i": 1 } as React.CSSProperties} className="jk-enter mt-[10px] text-[34px] font-medium leading-[40px] tracking-[-0.8px] lg:mt-3 lg:text-[44px] lg:leading-[52px] lg:tracking-[-1px]">{title}</h1>
      {sub && <p style={{ "--i": 2 } as React.CSSProperties} className={cn("jk-enter mt-1.5 text-[14.5px] leading-5 text-muted-foreground lg:mt-[7px] lg:text-[15.5px] lg:leading-[18px]", subClassName)}>{sub}</p>}
    </div>
  );
}
