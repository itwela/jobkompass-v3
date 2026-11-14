'use client'

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/lib/resume/types";
import type { ResumeMarks } from "@/lib/onboarding/resumeChanges";

const PAGE = 510; // natural width the page is typeset at, then scaled (same as JkDocPreview)

/** A changed passage: faint blue fill with a thin blue rule on the right edge. */
function Mark({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <div className={cn(on && "-mx-[12px] border-r-[2.5px] border-bar-3 bg-bar-3/13 px-[12px] py-[2px]")}>{children}</div>;
}

/** The section the editor is on (D08): pale gold fill with a 2px gold rule on the left edge. */
function Focus({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <div data-focus={on ? "" : undefined} className={cn(on && "-mx-[13px] border-l-2 border-plan bg-plan/14 px-[11px] py-[3px]")}>{children}</div>;
}

export type JkResumeFocus = { section: "header" | "summary" | "skills" | "experience" | "internships" | "projects" | "education" | "certifications"; index?: number } | null;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-[1em]">
      <p className="mb-[0.35em] border-b border-paper-foreground font-bold uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

const clean = (a?: (string | null | undefined)[] | null) => (a ?? []).map((s) => (s ?? "").trim()).filter(Boolean);

/**
 * The person's own resume as a page: real content, typeset in the resume font and
 * scaled to `width`. `marks` tints the passages tailoring changed. A shorter
 * `height` crops the page bottom.
 */
export default function JkResumePage({ content, marks, focus, width, height, className }: { content: ResumeContent; marks?: ResumeMarks; focus?: JkResumeFocus; width: number; height?: number | "auto"; className?: string }) {
  // height="auto": grow with the content (editor preview), never shorter than one letter page.
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [autoH, setAutoH] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (height !== "auto") return;
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setAutoH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);
  const on = (section: NonNullable<JkResumeFocus>["section"], index?: number) =>
    focus?.section === section && (index === undefined || focus.index === undefined || focus.index === index);
  const pi = content.personalInfo ?? ({} as ResumeContent["personalInfo"]);
  const name = `${pi.firstName ?? ""} ${pi.lastName ?? ""}`.trim() || pi.name || "";
  const contact = clean([pi.location, pi.email, pi.phone, pi.linkedin, pi.github, pi.portfolio]).join(" | ");
  const technical = clean(content.skills?.technical);
  const additional = clean(content.skills?.additional);
  const scale = width / PAGE;
  return (
    <div aria-label={`${name || "Resume"} resume`} role="img" className={cn("shrink-0 overflow-hidden rounded-[4px] bg-paper-warm shadow-lg", className)} style={{ width, height: height === "auto" ? Math.max((width * 11) / 8.5, (autoH ?? 0) * (width / PAGE)) : height ?? (width * 580) / 440 }}>
      <div
        ref={innerRef}
        className="origin-top-left px-9 pb-9 pt-[38px] text-[10.9px] leading-[1.48] text-paper-foreground"
        style={{ width: PAGE, transform: `scale(${scale})`, fontFamily: '"Times New Roman", Times, Georgia, serif' }}
      >
        <Focus on={on("header")}>
          {name && <p className="text-center text-[22.5px] font-bold leading-tight">{name}</p>}
          {contact && <p className="mt-[0.3em] text-center text-[10.2px]">{contact}</p>}
        </Focus>
        <div className="mb-[1.6em]" />

        {pi.summary && (
          <Section title="Professional Summary">
            <Focus on={on("summary")}><Mark on={marks?.summary}><p>{pi.summary}</p></Mark></Focus>
          </Section>
        )}

        {(technical.length > 0 || additional.length > 0) && (
          <Section title="Technical Skills">
            <Focus on={on("skills")}><Mark on={marks?.skills}>
              {technical.length > 0 && <p>{additional.length > 0 && "Technical: "}{technical.join(", ")}</p>}
              {additional.length > 0 && <p>Additional: {additional.join(", ")}</p>}
            </Mark></Focus>
          </Section>
        )}

        {(content.experience?.length ?? 0) > 0 && (
          <Section title="Professional Experience">
            {content.experience!.map((job, i) => (
              <div key={i} className={cn(i > 0 && "mt-[0.9em]")}>
                <Focus on={on("experience", i)}><Mark on={marks?.experience.includes(i)}>
                  <p className="flex justify-between gap-3 font-bold"><span>{clean([job.title, job.company]).join(", ")}</span><span className="shrink-0">{job.date}</span></p>
                  {clean(job.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}
                </Mark></Focus>
              </div>
            ))}
          </Section>
        )}

        {(content.internships?.length ?? 0) > 0 && (
          <Section title="Internships">
            {content.internships!.map((job, i) => (
              <div key={i} className={cn(i > 0 && "mt-[0.9em]")}>
                <Focus on={on("internships", i)}>
                  <p className="flex justify-between gap-3 font-bold"><span>{clean([job.title, job.company]).join(", ")}</span><span className="shrink-0">{job.date}</span></p>
                  {clean(job.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}
                </Focus>
              </div>
            ))}
          </Section>
        )}

        {(content.education?.length ?? 0) > 0 && (
          <Section title="Education">
            {content.education!.map((e, i) => (
              <Focus key={i} on={on("education", i)}><p className="flex justify-between gap-3"><span>{clean([e.degree, e.field && !e.degree?.includes(e.field) ? e.field : null, e.name]).join(", ")}</span><span className="shrink-0">{clean([e.startDate, e.endDate]).join(" - ")}</span></p></Focus>
            ))}
          </Section>
        )}

        {(content.projects?.length ?? 0) > 0 && (
          <Section title="Projects">
            {content.projects!.map((p, i) => (
              <Focus key={i} on={on("projects", i)}><Mark on={marks?.projects.includes(i)}><p><span className="font-bold">{p.name}</span> {p.description}</p>{clean(p.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}</Mark></Focus>
            ))}
          </Section>
        )}

        {(content.certifications?.length ?? 0) > 0 && (
          <Section title="Certifications">
            {content.certifications!.map((c, i) => <Focus key={i} on={on("certifications", i)}><p>{clean([c.name, c.issuer, c.date]).join(", ")}</p></Focus>)}
          </Section>
        )}
      </div>
    </div>
  );
}
