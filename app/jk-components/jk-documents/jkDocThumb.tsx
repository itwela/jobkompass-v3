'use client'

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ResumeContent } from "@/lib/resume/types";
import { cn } from "@/lib/utils";
import JkResumePage from "../jk-onboarding/jkResumePage";

/** True when stored content has enough to typeset a real page. */
export function hasRenderableResume(content: unknown): content is ResumeContent {
  const c = content as ResumeContent | null | undefined;
  if (!c || typeof c !== "object" || !c.personalInfo) return false;
  return Boolean(
    c.personalInfo.firstName || c.personalInfo.name || c.personalInfo.summary ||
    c.experience?.length || c.education?.length || c.skills?.technical?.length,
  );
}

/** Mounts children only once the box has scrolled near the viewport. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

const PDF_W = 408; // natural width the PDF viewer renders at before scaling down

/**
 * The page on a document card (D07 104x140, M06 ~91x130): the real resume
 * typeset from its content when there is content, otherwise the stored PDF's
 * first page.
 */
export default function JkDocThumb({ content, fileId, width, height, className }: {
  content?: unknown;
  fileId?: Id<"_storage">;
  width: number;
  height: number;
  className?: string;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const renderable = hasRenderableResume(content);
  const url = useQuery(api.documents.getFileUrl, !renderable && fileId && near ? { fileId } : "skip");
  const [loaded, setLoaded] = useState(false);
  const scale = width / PDF_W;

  return (
    <div ref={ref} className={cn("relative shrink-0 overflow-hidden rounded-[4px] bg-paper-warm shadow-lg", className)} style={{ width, height }}>
      {renderable ? (
        <JkResumePage content={content} width={width} height={height} className="rounded-[4px] shadow-none" />
      ) : url ? (
        <>
          <iframe
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            title="Document preview"
            tabIndex={-1}
            onLoad={() => setLoaded(true)}
            className={cn("pointer-events-none block origin-top-left border-0 bg-paper-warm transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
            style={{ width: PDF_W, height: height / scale, transform: `scale(${scale})` }}
          />
        </>
      ) : (
        <BlankPage />
      )}
    </div>
  );
}

/** Ruled placeholder while the file loads or when there is nothing to show. */
function BlankPage() {
  return (
    <div aria-hidden className="flex h-full flex-col gap-[3px] px-[12%] pt-[12%]">
      <span className="mx-auto mb-1 h-[3px] w-1/3 rounded-full bg-paper-foreground/25" />
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className={cn("h-[2px] rounded-full bg-paper-foreground/10", i % 5 === 0 ? "mt-1 w-1/2 bg-paper-foreground/20" : i % 3 === 0 ? "w-4/5" : "w-full")} />
      ))}
    </div>
  );
}
