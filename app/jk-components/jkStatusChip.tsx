import { cn } from "@/lib/utils";
import { STATUS_TEXT, statusKey, type StatusKey } from "@/lib/jkStatus";

/** Ring glyph per status: shape carries the meaning as well as colour. */
export function JkStatusGlyph({ status, className }: { status: string; className?: string }) {
  const k: StatusKey = statusKey(status);
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("size-4 shrink-0", STATUS_TEXT[k], className)}>
      {k === "ghosted" && <circle cx="8" cy="8" r="6" {...common} strokeDasharray="1.5 3" />}
      {k === "rejected" && (<><circle cx="8" cy="8" r="6" {...common} strokeWidth={1.5} /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" {...common} strokeWidth={1.5} /></>)}
      {k === "offered" && (<><circle cx="8" cy="8" r="6" {...common} /><circle cx="8" cy="8" r="2.2" fill="currentColor" /></>)}
      {(k === "interested" || k === "applied" || k === "callback" || k === "interviewing") && (
        <>
          <circle cx="8" cy="8" r="6" {...common} opacity={0.3} />
          <path d={k === "interested" ? "M8 2a6 6 0 0 1 6 6" : k === "applied" ? "M8 2a6 6 0 0 1 0 12" : k === "callback" ? "M8 2a6 6 0 1 1-6 6" : "M8 2a6 6 0 1 1-4.24 1.76"} {...common} />
        </>
      )}
    </svg>
  );
}

export default function JkStatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm text-foreground", className)}>
      <JkStatusGlyph status={status} />
      {status}
    </span>
  );
}
