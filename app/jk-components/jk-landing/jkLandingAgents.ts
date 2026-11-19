import type { ModelMark } from "@/lib/agentActivity/modelMark";

// The landing CLI row: marks come from the shared JkAgentMark set.
export const CLI_AGENTS: { name: string; href: string; mark: ModelMark }[] = [
  { name: "Claude Code", href: "https://www.anthropic.com/claude-code", mark: "claude" },
  { name: "Codex", href: "https://openai.com/codex", mark: "openai" },
  { name: "Muse", href: "https://research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2", mark: "muse" },
  { name: "Gemini CLI", href: "https://github.com/google-gemini/gemini-cli", mark: "gemini" },
  { name: "Cursor", href: "https://cursor.com", mark: "cursor" },
  { name: "Copilot", href: "https://github.com/features/copilot", mark: "copilot" },
];

/** What a person pastes into any agent to get it set up with jk. Keep every command real (see cli/README.md). */
export const CLI_AGENT_PROMPT = `Set up the JobKompass CLI so you can run my job search for me.

1. Install it: npm install -g jobkompass-cli
2. Ask me for my JobKompass API key. I create it at https://www.myjobkompass.com under Settings, CLI keys. Then run: jk auth login <key>
3. Run "jk schema" and read it. It lists every command and field.
4. Check it works: jk jobs list

After that, when I give you a job posting:
- save the job with jk jobs add
- write a resume for it from my base resume and save it with jk resumes add
- tell me what you saved

Never invent numbers, employers or skills for my resume. If a bullet needs a number, ask me for it.`;
