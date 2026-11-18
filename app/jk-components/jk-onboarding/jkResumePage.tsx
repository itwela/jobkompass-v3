'use client'

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/lib/resume/types";
import type { ResumeMarks } from "@/lib/onboarding/resumeChanges";

const PAGE = 510; // natural width the page is typeset at, then scaled (same as JkDocPreview)

/** A changed passage: faint blue fill with a thin blue rule on the right edge. */
function Mark({ on, name, children }: { on?: boolean; name?: string; children: React.ReactNode }) {
  // data-mark lets a caller line margin notes up with a changed passage (chat's Artifacts panel).
  return <div data-mark={on ? name : undefined} className={cn(on && "-mx-[12px] border-r-[2.5px] border-bar-3 bg-bar-3/13 px-[12px] py-[2px]")}>{children}</div>;
}

/** The section the editor is on (D08): pale gold fill with a 2px gold rule on the left edge. */
function Focus({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <div data-focus={on ? "" : undefined} className={cn(on && "-mx-[13px] border-l-2 border-plan bg-plan/14 px-[11px] py-[3px]")}>{children}</div>;
}

export type JkResumeFocus = { section: "header" | "summary" | "skills" | "experience" | "internships" | "projects" | "education" | "certifications"; index?: number } | null;

/** Which PDF template the page imitates. Without one the page keeps its neutral look. */
export type JkResumeTemplate = "jake" | "joseph" | "mar";
type Look = "plain" | JkResumeTemplate;
type Block = "summary" | "skills" | "experience" | "internships" | "education" | "projects" | "certifications";

/** Font, section order and section names of each real template (see lib/resume/generate*Latex.ts). */
const LOOKS: Record<Look, { font: string; order: Block[]; titles: Partial<Record<Block, string>> }> = {
  plain: {
    font: '"Times New Roman", Times, Georgia, serif',
    order: ["summary", "skills", "experience", "internships", "education", "projects", "certifications"],
    titles: {},
  },
  jake: {
    font: '"Latin Modern Roman", "CMU Serif", "Computer Modern", Georgia, "Times New Roman", serif',
    order: ["summary", "education", "experience", "internships", "projects", "skills", "certifications"],
    titles: { experience: "Experience" },
  },
  joseph: {
    font: 'Lato, Calibri, Carlito, "Helvetica Neue", Arial, sans-serif',
    order: ["summary", "skills", "experience", "internships", "projects", "education"],
    titles: { summary: "Profile Summary", skills: "Core Competencies", projects: "Key Projects", education: "Education and Professional Development" },
  },
  mar: {
    font: '"Times New Roman", Times, serif',
    order: ["summary", "skills", "education", "experience", "internships", "projects"],
    titles: { education: "Education & Certifications", projects: "Technical Projects" },
  },
};
const TITLES: Record<Block, string> = {
  summary: "Professional Summary", skills: "Technical Skills", experience: "Professional Experience", internships: "Internships",
  education: "Education", projects: "Projects", certifications: "Certifications",
};

function Section({ title, look, children }: { title: string; look: Look; children: React.ReactNode }) {
  return (
    <div className="mb-[1em]">
      {look === "jake" ? (
        <p className="mb-[0.35em] border-b border-paper-foreground text-[12.5px] tracking-wide [font-variant:small-caps]">{title}</p>
      ) : look === "joseph" ? (
        <p className="mb-[0.5em] flex items-center gap-[0.8em] font-bold uppercase"><span>{title}</span><span aria-hidden className="h-px flex-1 bg-paper-foreground" /></p>
      ) : look === "mar" ? (
        <p className="mb-[0.15em] text-[13.5px] font-bold leading-snug">{title}</p>
      ) : (
        <p className="mb-[0.35em] border-b border-paper-foreground font-bold uppercase tracking-wide">{title}</p>
      )}
      {children}
    </div>
  );
}

/** One job's heading line, laid out the way the template prints it. */
function JobHead({ job, look }: { job: { title?: string | null; company?: string | null; date?: string | null; location?: string | null }; look: Look }) {
  if (look === "jake") {
    return (
      <>
        <p className="flex justify-between gap-3"><span className="font-bold">{job.title}</span><span className="shrink-0">{job.date}</span></p>
        {job.company && <p className="italic">{job.company}</p>}
      </>
    );
  }
  if (look === "joseph" || look === "mar") {
    const rest = look === "mar" ? clean([job.company, job.location]) : [];
    return (
      <p className="flex justify-between gap-3">
        <span><span className="font-bold">{look === "joseph" ? clean([job.title, job.company]).join(" | ") : job.title}</span>{rest.length > 0 && ` | ${rest.join(" | ")}`}</span>
        <span className="shrink-0">{job.date}</span>
      </p>
    );
  }
  return <p className="flex justify-between gap-3 font-bold"><span>{clean([job.title, job.company]).join(", ")}</span><span className="shrink-0">{job.date}</span></p>;
}

const clean = (a?: (string | null | undefined)[] | null) => (a ?? []).map((s) => (s ?? "").trim()).filter(Boolean);

/**
 * The person's own resume as a page: real content, typeset in the resume font and
 * scaled to `width`. `template` lays it out like that PDF template. `marks` tints the passages tailoring changed. A shorter
 * `height` crops the page bottom.
 */
export default function JkResumePage({ content, marks, focus, template, width, height, className }: { content: ResumeContent; marks?: ResumeMarks; focus?: JkResumeFocus; template?: JkResumeTemplate; width: number; height?: number | "auto"; className?: string }) {
  const look: Look = template && template in LOOKS ? template : "plain";
  const { font, order, titles } = LOOKS[look];
  const title = (b: Block) => titles[b] ?? TITLES[b];
  const mergeCerts = !order.includes("certifications");
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
    <div aria-label={`${name || "Resume"} resume`} role="img" className={cn("shrink-0 overflow-hidden rounded-[4px] bg-paper-warm shadow-lg", className)} style={{ width, height: height === "auto" ? Math.max((width * 660) / 480, (autoH ?? 0) * (width / PAGE)) : height ?? (width * 580) / 440 }}>
      <div
        ref={innerRef}
        className="origin-top-left px-9 pb-9 pt-[38px] text-[10.9px] leading-[1.48] text-paper-foreground"
        style={{ width: PAGE, transform: `scale(${scale})`, fontFamily: font }}
      >
        {look === "joseph" ? (
          <Focus on={on("header")}>
            <div className="flex items-end justify-between gap-4">
              {name && <p className="text-[22.5px] font-bold leading-tight">{name}</p>}
              <div className="text-right text-[10.2px] leading-[1.4]">
                {pi.location && <p>{pi.location}</p>}
                {clean([pi.email, pi.phone]).length > 0 && <p>{clean([pi.email, pi.phone]).join(" | ")}</p>}
                {clean([pi.linkedin, pi.github, pi.portfolio]).length > 0 && <p>{clean([pi.linkedin, pi.github, pi.portfolio]).join(" | ")}</p>}
              </div>
            </div>
          </Focus>
        ) : (
          <Focus on={on("header")}>
            {name && <p className={cn("text-center text-[22.5px] leading-tight", look === "mar" ? "font-normal" : "font-bold")}>{name}</p>}
            {contact && <p className="mt-[0.3em] text-center text-[10.2px]">{contact}</p>}
          </Focus>
        )}
        {look === "mar" ? <div aria-hidden className="mb-[1.2em] mt-[1em] h-px bg-paper-foreground" /> : <div className="mb-[1.6em]" />}

        {order.map((block) => {
          if (block === "summary") return pi.summary ? (
            <Section key={block} look={look} title={title(block)}>
              <Focus on={on("summary")}><Mark on={marks?.summary} name="summary"><p>{pi.summary}</p></Mark></Focus>
            </Section>
          ) : null;

          if (block === "skills") return technical.length > 0 || additional.length > 0 ? (
            <Section key={block} look={look} title={title(block)}>
              <Focus on={on("skills")}><Mark on={marks?.skills} name="skills">
                {look === "joseph" ? (
                  <p>{[...technical, ...additional].join(" | ")}</p>
                ) : (
                  <>
                    {technical.length > 0 && <p>{additional.length > 0 && <span className={cn(look !== "plain" && "font-bold")}>{look === "jake" ? "Languages: " : "Technical: "}</span>}{technical.join(", ")}</p>}
                    {additional.length > 0 && <p><span className={cn(look !== "plain" && "font-bold")}>{look === "jake" ? "Additional Skills: " : "Additional: "}</span>{additional.join(", ")}</p>}
                  </>
                )}
              </Mark></Focus>
            </Section>
          ) : null;

          if (block === "experience") return (content.experience?.length ?? 0) > 0 ? (
            <Section key={block} look={look} title={title(block)}>
              {content.experience!.map((job, i) => (
                <div key={i} className={cn(i > 0 && "mt-[0.9em]")}>
                  <Focus on={on("experience", i)}><Mark on={marks?.experience.includes(i)} name="experience">
                    <JobHead job={job} look={look} />
                    {clean(job.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}
                  </Mark></Focus>
                </div>
              ))}
            </Section>
          ) : null;

          if (block === "internships") return (content.internships?.length ?? 0) > 0 ? (
            <Section key={block} look={look} title={title(block)}>
              {content.internships!.map((job, i) => (
                <div key={i} className={cn(i > 0 && "mt-[0.9em]")}>
                  <Focus on={on("internships", i)}>
                    <JobHead job={job} look={look} />
                    {clean(job.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}
                  </Focus>
                </div>
              ))}
            </Section>
          ) : null;

          if (block === "education") {
            const certs = mergeCerts ? content.certifications ?? [] : [];
            return (content.education?.length ?? 0) > 0 || certs.length > 0 ? (
              <Section key={block} look={look} title={title(block)}>
                {(content.education ?? []).map((e, i) => (
                  <Focus key={i} on={on("education", i)}>
                    {look === "jake" ? (
                      <>
                        <p className="font-bold">{e.name}</p>
                        <p className="flex justify-between gap-3 italic"><span>{clean([e.degree, e.field && !e.degree?.includes(e.field) ? e.field : null]).join(", ")}</span><span className="shrink-0">{clean([e.startDate, e.endDate]).join(" - ")}</span></p>
                      </>
                    ) : look === "plain" ? (
                      <p className="flex justify-between gap-3"><span>{clean([e.degree, e.field && !e.degree?.includes(e.field) ? e.field : null, e.name]).join(", ")}</span><span className="shrink-0">{clean([e.startDate, e.endDate]).join(" - ")}</span></p>
                    ) : (
                      <p className="flex justify-between gap-3"><span><span className="font-bold">{e.name}</span>{clean([e.degree, e.field && !e.degree?.includes(e.field) ? e.field : null]).map((x) => ` | ${x}`).join("")}</span><span className="shrink-0">{clean([e.startDate, e.endDate]).join(" - ")}</span></p>
                    )}
                  </Focus>
                ))}
                {certs.map((c, i) => (
                  <Focus key={`c${i}`} on={on("certifications", i)}>
                    <p className="flex justify-between gap-3"><span><span className="font-bold">{c.name}</span>{c.issuer ? ` | ${c.issuer}` : ""}</span><span className="shrink-0">{c.date}</span></p>
                  </Focus>
                ))}
              </Section>
            ) : null;
          }

          if (block === "projects") return (content.projects?.length ?? 0) > 0 ? (
            <Section key={block} look={look} title={title(block)}>
              {content.projects!.map((p, i) => (
                <Focus key={i} on={on("projects", i)}><Mark on={marks?.projects.includes(i)} name="projects"><p><span className="font-bold">{p.name}</span> {p.description && <span className={cn(look === "jake" && "italic")}>{look === "plain" ? p.description : `| ${p.description}`}</span>}</p>{clean(p.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}</Mark></Focus>
              ))}
            </Section>
          ) : null;

          return (content.certifications?.length ?? 0) > 0 ? (
            <Section key={block} look={look} title={title(block)}>
              {content.certifications!.map((c, i) => <Focus key={i} on={on("certifications", i)}><p>{clean([c.name, c.issuer, c.date]).join(", ")}</p></Focus>)}
            </Section>
          ) : null;
        })}
      </div>
    </div>
  );
}
