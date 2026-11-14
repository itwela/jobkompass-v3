import { cn } from "@/lib/utils";
import JkArt, { type JkArtName } from "../jkArt";

/**
 * JkAppPageHeader — the top of every in-app screen (D03 My Jobs, D07 My Documents, D11 Performance).
 *
 *   <JkAppPageHeader
 *     title="My Jobs"
 *     sub={`${total} saved · ${applied} applied · ${interviewing} interviewing`}
 *     actions={<><SearchField/><JkSegmented …/><Button>Add job</Button></>}
 *     bottom={<JkStatusBar …/>}
 *     art="waves"
 *   />
 *
 * Props
 *   title            big title (Creato 28px Medium, -0.5px). On phones the title lives in the
 *                    phone header (JkAppMobileHeader), so here it is hidden below `lg` unless
 *                    `showTitleOnMobile`.
 *   sub?             one line under the title — real counts only.
 *   actions?         right-hand slot: search field, JkSegmented, buttons. Sits beside the title on
 *                    wide screens and wraps under it when it no longer fits. Visible at all widths.
 *   bottom?          full-width slot under the title row (e.g. the status bar on My Jobs, filter chips).
 *   art?             painting behind the band (JkArt name). Default "waves". Pass null for none.
 *   live?            animate the painting when it has a scene loop (waves, signal, harbour, ship1-4). Default true.
 *   artPosition?     object-position of the painting, e.g. "right 20%" (D07 papers sit top-right). Default "center 62%".
 *   artHeight?       px height of the painting band from the top of the header. Default: the header's
 *                    own height (D03 152). Larger values let the painting run behind the content
 *                    (D07 papers = 220), it always dissolves into the surface.
 *   mobileArt?       also show the painting below `lg` (the M-frames mostly don't). Default false.
 *   showTitleOnMobile? show title + sub below `lg` too. Default false.
 *   divider?         1px --border line under the header. Default true.
 *   className        extra classes on the <header>.
 *
 * The header is a [data-enter] section: title, sub, actions and bottom rise in with the shared
 * .jk-enter stagger. Remount it (React key) when the view changes and it replays — the shell
 * already does this per mode.
 */
export default function JkAppPageHeader({
  title, sub, actions, bottom, art = "waves", live = true, artHeight, artPosition = "center 62%", mobileArt = false,
  showTitleOnMobile = false, divider = true, className,
}: {
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  bottom?: React.ReactNode;
  art?: JkArtName | null;
  live?: boolean;
  artHeight?: number;
  artPosition?: string;
  mobileArt?: boolean;
  showTitleOnMobile?: boolean;
  divider?: boolean;
  className?: string;
}) {
  return (
    <header
      data-enter
      className={cn(
        "relative isolate shrink-0 px-5 pb-5 pt-4 lg:px-8 lg:pb-5 lg:pt-5",
        divider && "border-b border-border",
        // Nothing left to show on a phone (title is in the phone header): drop the band.
        !showTitleOnMobile && !actions && !bottom && !mobileArt && "hidden lg:block",
        className,
      )}
    >
      {art && (
        <div
          aria-hidden
          className={cn("jk-page-art pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden", mobileArt ? "block" : "hidden lg:block", !artHeight && "bottom-0")}
          style={artHeight ? { height: artHeight } : undefined}
        >
          <JkArt name={art} variant="section" fade="none" live={live} position={artPosition} />
          {/* The frame's veil (background @ 35%), then the painting dissolves into the
              surface downward and toward the title on the left — no hard edges. */}
          <div className="absolute inset-0 bg-background/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 via-30% to-transparent to-60%" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-background" />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className={cn("min-w-0 pt-px", !showTitleOnMobile && "hidden lg:block")}>
          <h1 className="jk-enter text-[28px] font-medium leading-[33px] tracking-[-0.5px] text-foreground" style={{ "--i": 0 } as React.CSSProperties}>
            {title}
          </h1>
          {sub && (
            <p className="jk-enter mt-0.5 text-[13.5px] leading-4 text-muted-foreground" style={{ "--i": 1 } as React.CSSProperties}>
              {sub}
            </p>
          )}
        </div>
        {actions && (
          <div className="jk-enter flex min-w-0 max-w-full flex-wrap items-center gap-2.5 lg:pt-0.5" style={{ "--i": 2 } as React.CSSProperties}>
            {actions}
          </div>
        )}
      </div>

      {bottom && (
        <div className="jk-enter mt-4 lg:mt-2" style={{ "--i": 3 } as React.CSSProperties}>
          {bottom}
        </div>
      )}
    </header>
  );
}
