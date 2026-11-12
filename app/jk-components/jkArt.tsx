import { cn } from "@/lib/utils";

export type JkArtName =
  | "hero" | "harbour" | "waves" | "signal" | "chart" | "cabin" | "papers"
  | "ship1" | "ship2" | "ship3" | "ship4" | "step1" | "step2" | "step3" | "step4";

interface JkArtProps {
  name: JkArtName;
  /** band: wide strip behind a header. section: fills its positioned parent. spot: small square illustration, shown whole. */
  variant?: "band" | "spot" | "section";
  /** Where the painting dissolves into the surface. Defaults to all four sides. */
  fade?: "all" | "y" | "bottom";
  /** object-position for cover variants, e.g. "center bottom". */
  position?: string;
  className?: string;
}

/**
 * A painting that fades into the surface on all four sides. Both the night and
 * day versions are rendered and CSS picks one, so the right painting is there
 * on first paint whichever theme the pre-paint script chose.
 */
export default function JkArt({ name, variant = "section", fade = "all", position, className }: JkArtProps) {
  const wrap =
    variant === "section"
      ? "pointer-events-none absolute inset-0 overflow-hidden"
      : variant === "band"
        ? "pointer-events-none relative h-40 w-full overflow-hidden sm:h-56"
        : "pointer-events-none relative aspect-square w-full overflow-hidden";
  const img = cn(
    "h-full w-full select-none",
    variant === "spot" ? "object-contain jk-art-fade-soft" : cn("object-cover", fade === "y" ? "jk-art-fade-y" : fade === "bottom" ? "jk-art-fade-b" : "jk-art-fade"),
  );
  return (
    <div aria-hidden className={cn(wrap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/v4/${name}-night.webp`} alt="" loading="lazy" decoding="async" draggable={false} style={position ? { objectPosition: position } : undefined} className={cn(img, "hidden dark:block")} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/v4/${name}-day.webp`} alt="" loading="lazy" decoding="async" draggable={false} style={position ? { objectPosition: position } : undefined} className={cn(img, "block dark:hidden")} />
    </div>
  );
}
