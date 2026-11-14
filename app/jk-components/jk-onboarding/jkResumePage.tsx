import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/lib/resume/types";
import type { ResumeMarks } from "@/lib/onboarding/resumeChanges";

const PAGE = 510; // natural width the page is typeset at, then scaled (same as JkDocPreview)

/** A changed passage: faint blue fill with a thin blue rule on the right edge. */
function Mark({ on, name, children }: { on?: boolean; name?: string; children: React.ReactNode }) {
  // data-mark lets a caller line margin notes up with a changed passage (chat's Artifacts panel).
  return <div data-mark={on ? name : undefined} className={cn(on && "-mx-[12px] border-r-[2.5px] border-bar-3 bg-bar-3/13 px-[12px] py-[2px]")}>{children}</div>;
}

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
export default function JkResumePage({ content, marks, width, height, className }: { content: ResumeContent; marks?: ResumeMarks; width: number; height?: number; className?: string }) {
  const pi = content.personalInfo ?? ({} as ResumeContent["personalInfo"]);
  const name = `${pi.firstName ?? ""} ${pi.lastName ?? ""}`.trim() || pi.name || "";
  const contact = clean([pi.location, pi.email, pi.phone, pi.linkedin, pi.github, pi.portfolio]).join(" | ");
  const technical = clean(content.skills?.technical);
  const additional = clean(content.skills?.additional);
  const scale = width / PAGE;
  return (
    <div aria-label={`${name || "Resume"} resume`} role="img" className={cn("shrink-0 overflow-hidden rounded-[4px] bg-paper-warm shadow-lg", className)} style={{ width, height: height ?? (width * 580) / 440 }}>
      <div
        className="origin-top-left px-9 pb-9 pt-[38px] text-[10.9px] leading-[1.48] text-paper-foreground"
        style={{ width: PAGE, transform: `scale(${scale})`, fontFamily: '"Times New Roman", Times, Georgia, serif' }}
      >
        {name && <p className="text-center text-[22.5px] font-bold leading-tight">{name}</p>}
        {contact && <p className="mb-[1.6em] mt-[0.3em] text-center text-[10.2px]">{contact}</p>}

        {pi.summary && (
          <Section title="Professional Summary">
            <Mark on={marks?.summary} name="summary"><p>{pi.summary}</p></Mark>
          </Section>
        )}

        {(technical.length > 0 || additional.length > 0) && (
          <Section title="Technical Skills">
            <Mark on={marks?.skills} name="skills">
              {technical.length > 0 && <p>{additional.length > 0 && "Technical: "}{technical.join(", ")}</p>}
              {additional.length > 0 && <p>Additional: {additional.join(", ")}</p>}
            </Mark>
          </Section>
        )}

        {(content.experience?.length ?? 0) > 0 && (
          <Section title="Professional Experience">
            {content.experience!.map((job, i) => (
              <div key={i} className={cn(i > 0 && "mt-[0.9em]")}>
                <Mark on={marks?.experience.includes(i)} name="experience">
                  <p className="flex justify-between gap-3 font-bold"><span>{clean([job.title, job.company]).join(", ")}</span><span className="shrink-0">{job.date}</span></p>
                  {clean(job.details).map((d, j) => <p key={j} className="pl-[0.6em] -indent-[0.6em]">• {d}</p>)}
                </Mark>
              </div>
            ))}
          </Section>
        )}

        {(content.education?.length ?? 0) > 0 && (
          <Section title="Education">
            {content.education!.map((e, i) => (
              <p key={i} className="flex justify-between gap-3"><span>{clean([e.degree, e.field && !e.degree?.includes(e.field) ? e.field : null, e.name]).join(", ")}</span><span className="shrink-0">{clean([e.startDate, e.endDate]).join(" - ")}</span></p>
            ))}
          </Section>
        )}

        {(content.projects?.length ?? 0) > 0 && (
          <Section title="Projects">
            {content.projects!.map((p, i) => (
              <Mark key={i} on={marks?.projects.includes(i)} name="projects"><p><span className="font-bold">{p.name}</span> {p.description}</p></Mark>
            ))}
          </Section>
        )}

        {(content.certifications?.length ?? 0) > 0 && (
          <Section title="Certifications">
            {content.certifications!.map((c, i) => <p key={i}>{clean([c.name, c.issuer, c.date]).join(", ")}</p>)}
          </Section>
        )}
      </div>
    </div>
  );
}
