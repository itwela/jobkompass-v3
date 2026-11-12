'use client'

import { useState } from "react";
import { cn } from "@/lib/utils";

interface JkCompanyLogoProps {
  company: string;
  /** Company website domain, e.g. "stripe.com". Without it the monogram is shown. */
  domain?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = { sm: "size-6 text-[10px] rounded-md", md: "size-8 text-xs rounded-lg", lg: "size-11 text-sm rounded-xl" };

/** Company mark: the site's favicon when a domain is known, otherwise a neutral monogram. */
export default function JkCompanyLogo({ company, domain, size = "md", className }: JkCompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const letter = (company || "?").trim().charAt(0).toUpperCase() || "?";
  const clean = domain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  const base = cn("inline-flex shrink-0 items-center justify-center overflow-hidden border border-input bg-muted font-medium text-muted-foreground", SIZE[size], className);
  if (clean && !failed) {
    return (
      <span className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=64`} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    );
  }
  return <span className={base} aria-hidden>{letter}</span>;
}
