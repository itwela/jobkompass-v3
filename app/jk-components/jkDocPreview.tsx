import { cn } from "@/lib/utils";

interface JkDocPreviewProps {
  kind?: "resume" | "letter";
  size?: "sm" | "md" | "lg";
  /** Exact width in px; overrides size. */
  width?: number;
  /** Exact height in px; defaults to letter proportions. Shorter heights crop the page bottom. */
  height?: number;
  /** Tint the passages the tailoring changed (resume only). */
  highlight?: boolean;
  className?: string;
}

const RESUME: [string, { mark?: boolean; lines: string[] }[]][] = [
  ["PROFESSIONAL SUMMARY", [{ mark: true, lines: ["Software engineer who builds AI agents and internal tools. Daily", "Claude Code user with production MCP servers, Python APIs, and RAG", "pipelines that connect company data to LLM workflows."] }]],
  ["TECHNICAL SKILLS", [{ mark: true, lines: ["AI: Claude Code, MCP, RAG, prompt design, evals", "Languages: Python, TypeScript, SQL", "Backend: REST APIs, FastAPI, Postgres, AWS"] }]],
  ["PROFESSIONAL EXPERIENCE", [
    { mark: true, lines: ["Founder and Software Engineer, JobKompass 2024 - Present", "• Built an MCP server that lets agents read and write job records.", "• Used Claude Code to ship features end to end, from spec to tests.", "• Designed a RAG pipeline in Python that matches resumes to posts."] },
    { lines: ["Software Engineer, Dope Marketing 2023 - 2024", "• Built the internal AI platform: RAG over millions of records.", "• Three tools adopted company-wide, lookups over 60% faster."] },
  ]],
  ["EDUCATION", [{ lines: ["B.S., Western Governors University (in progress)"] }]],
  ["PROJECTS", [{ lines: ["jk CLI Agent-first command line for JobKompass, 12 agent tools.", "Mosaic Multi-terminal workspace manager in Tauri and React."] }]],
];

const W = { sm: 128, md: 192, lg: 288 };
const PAGE = 510; // natural width the page is typeset at, then scaled down

/** A miniature page with real, readable text, typeset once and scaled to size. */
export default function JkDocPreview({ kind = "resume", size = "md", width, height, highlight = false, className }: JkDocPreviewProps) {
  const w = width ?? W[size];
  return (
    <div aria-hidden className={cn("shrink-0 overflow-hidden rounded-md bg-paper shadow-lg", className)} style={{ width: w, height: height ?? (w * 11) / 8.5 }}>
      <div
        className="origin-top-left p-9 text-[10px] leading-[1.45] text-paper-foreground"
        style={{ width: PAGE, height: (PAGE * 11) / 8.5, transform: `scale(${w / PAGE})`, fontFamily: '"Times New Roman", Georgia, serif' }}
      >
      {kind === "resume" ? (
        <>
          <p className="text-center text-[1.9em] font-bold leading-tight">Itwela Ibomu</p>
          <p className="mb-[1.4em] text-center text-[0.9em]">Remote, US | itwela@email.com | github.com/itwela</p>
          {RESUME.map(([h, blocks]) => (
            <div key={h} className="mb-[1em]">
              <p className="mb-[0.35em] border-b-[1.5px] border-paper-foreground font-bold tracking-wide">{h}</p>
              {blocks.map((b, i) => (
                <div key={i} className={cn(i > 0 && "mt-[0.9em]", highlight && b.mark && "-mx-[8px] border-r-[9px] border-bar-3 bg-bar-3/15 px-[8px] py-[2px]")} data-mark={b.mark ? "" : undefined}>
                  {b.lines.map((l) => <p key={l} className={l.startsWith("Founder") || l.startsWith("Software Engineer,") ? "font-bold" : undefined}>{l}</p>)}
                </div>
              ))}
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
