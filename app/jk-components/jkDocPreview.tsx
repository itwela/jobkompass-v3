import { cn } from "@/lib/utils";

interface JkDocPreviewProps {
  kind?: "resume" | "letter";
  size?: "sm" | "md" | "lg";
  /** Exact width in px; overrides size. */
  width?: number;
  className?: string;
}

const W = { sm: 128, md: 192, lg: 288 };
const PAGE = 510; // natural width the page is typeset at, then scaled down

/** A miniature page with real, readable text, typeset once and scaled to size. */
export default function JkDocPreview({ kind = "resume", size = "md", width, className }: JkDocPreviewProps) {
  const w = width ?? W[size];
  return (
    <div aria-hidden className={cn("shrink-0 overflow-hidden rounded-md bg-paper shadow-lg", className)} style={{ width: w, height: (w * 11) / 8.5 }}>
      <div
        className="origin-top-left p-9 text-[10px] leading-[1.45] text-paper-foreground"
        style={{ width: PAGE, height: (PAGE * 11) / 8.5, transform: `scale(${w / PAGE})`, fontFamily: '"Times New Roman", Georgia, serif' }}
      >
      {kind === "resume" ? (
        <>
          <p className="text-center text-[1.9em] font-bold leading-tight">Itwela Ibomu</p>
          <p className="mb-[1em] text-center">Remote, US | github.com/itwela</p>
          {[
            ["PROFESSIONAL SUMMARY", ["Software engineer who builds AI agents and internal tools. Daily Claude Code user with production MCP servers, Python APIs, and RAG pipelines."]],
            ["TECHNICAL SKILLS", ["AI: Claude Code, MCP, RAG, prompt design, evals", "Languages: Python, TypeScript, SQL", "Backend: REST APIs, FastAPI, Postgres, AWS"]],
            ["PROFESSIONAL EXPERIENCE", ["Founder and Software Engineer, JobKompass · 2024 - Present", "• Built an MCP server that lets agents read and write job records.", "• Designed a RAG pipeline in Python that matches resumes to posts.", "Software Engineer, Dope Marketing · 2023 - 2024", "• Built the internal AI platform: RAG over millions of records.", "• Three tools adopted company-wide, lookups over 60% faster."]],
            ["PROJECTS", ["jk CLI: agent-first command line for JobKompass, 12 agent tools."]],
          ].map(([h, lines]) => (
            <div key={h as string} className="mb-[0.9em]">
              <p className="mb-[0.3em] border-b border-paper-foreground/70 font-bold tracking-wider">{h}</p>
              {(lines as string[]).map((l) => <p key={l}>{l}</p>)}
            </div>
          ))}
        </>
      ) : (
        <>
          <p className="text-[1.5em] font-bold">Itwela Ibomu</p>
          <p className="mb-[1.6em]">Remote, US | github.com/itwela</p>
          <p className="mb-[1em]">Dear Hiring Manager,</p>
          <p className="mb-[1em]">I build AI agents and the internal tools around them. At Dope Marketing I built the internal AI platform, RAG over millions of records, and three tools the whole company adopted.</p>
          <p className="mb-[1em]">JobKompass is my own product: an MCP server, a Python RAG pipeline, and an agent-first CLI with 12 tools. I ship features end to end, from spec to tests.</p>
          <p className="mb-[1em]">I would like to bring that to your team.</p>
          <p>Sincerely,<br />Itwela Ibomu</p>
        </>
      )}
      </div>
    </div>
  );
}
