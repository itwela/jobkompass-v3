import { cn } from "@/lib/utils";
import JkSceneLoop from "./jkSceneLoop";
import { SCENES, type JkSceneName } from "./jk-landing/jkSceneShader";

export type JkArtName =
  | "hero" | "harbour" | "waves" | "signal" | "chart" | "cabin" | "papers"
  | "ship1" | "ship2" | "ship3" | "ship4" | "step1" | "step2" | "step3" | "step4";

interface JkArtProps {
  name: JkArtName;
  /** band: wide strip behind a header. section: fills its positioned parent. spot: small square illustration, shown whole. */
  variant?: "band" | "spot" | "section";
  /** Where the painting dissolves into the surface. Defaults to all four sides. */
  fade?: "all" | "y" | "bottom" | "left" | "none";
  /** object-position for cover variants, e.g. "center bottom". */
  position?: string;
  className?: string;
  /** Animate the night painting with its scene loop (ships, harbour, waves, signal). */
  live?: boolean;
  /** Ancestor selector whose hover stirs the water harder. */
  hoverHost?: string;
  /** Multiplies the scene's motion strength. */
  gain?: number;
  /** Crop centre for a live painting (0..1 each); defaults to the scene's own focus. */
  focus?: [number, number];
}

/**
 * A painting that fades into the surface on all four sides. Both the night and
 * day versions are rendered and CSS picks one, so the right painting is there
 * on first paint whichever theme the pre-paint script chose.
 */
export default function JkArt({ name, variant = "section", fade = "all", position, className, live = false, hoverHost, gain = 1, focus }: JkArtProps) {
  const scene = live && name in SCENES ? (name as JkSceneName) : null;
  // A live painting is cropped where its shader looks, so the still image and the loop line up.
  if (scene) { const [fx, fy] = focus ?? SCENES[scene].focus; position = `${fx * 100}% ${fy * 100}%`; }
  const wrap =
    variant === "section"
      ? "pointer-events-none absolute inset-0 overflow-hidden"
      : variant === "band"
        ? "pointer-events-none relative h-40 w-full overflow-hidden sm:h-56"
        : "pointer-events-none relative aspect-square w-full overflow-hidden";
  const fadeCls = variant === "spot" ? "jk-art-fade-soft" : fade === "none" ? "" : fade === "y" ? "jk-art-fade-y" : fade === "bottom" ? "jk-art-fade-b" : fade === "left" ? "jk-art-fade-l" : "jk-art-fade";
  const img = cn("h-full w-full select-none", variant === "spot" ? "object-contain" : "object-cover", fadeCls);
  return (
    <div aria-hidden className={cn(wrap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/v4/${name}-night.webp`} alt="" loading="lazy" decoding="async" draggable={false} style={position ? { objectPosition: position } : undefined} className={cn(img, "hidden dark:block")} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/v4/${name}-day.webp`} alt="" loading="lazy" decoding="async" draggable={false} style={position ? { objectPosition: position } : undefined} className={cn(img, "block dark:hidden")} />
      {scene && <JkSceneLoop scene={scene} focus={focus} gain={gain} hoverHost={hoverHost} className={cn("absolute inset-0 hidden size-full dark:block", fadeCls)} />}
      {scene && <JkSceneLoop scene={scene} focus={focus} day gain={gain} hoverHost={hoverHost} className={cn("absolute inset-0 block size-full dark:hidden", fadeCls)} />}
    </div>
  );
}
