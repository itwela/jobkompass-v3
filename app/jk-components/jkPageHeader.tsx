import { cn } from "@/lib/utils";
import JkArt, { type JkArtName } from "./jkArt";

interface JkPageHeaderProps {
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  art?: JkArtName;
  className?: string;
}

/** Title, one line of context, and actions. Every app mode starts with this. */
export default function JkPageHeader({ title, sub, actions, art, className }: JkPageHeaderProps) {
  return (
    <header className={cn("relative isolate", className)}>
      {art && <JkArt name={art} variant="section" className="-z-10 opacity-60" />}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-medium tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {sub && <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
