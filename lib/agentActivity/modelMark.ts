/**
 * Which landing-page agent mark to show for a model id or provider name.
 * Only marks the landing already ships are returned; anything else is null (neutral icon).
 */
export type ModelMark = "claude" | "openai" | "gemini" | "copilot" | "muse" | "cursor" | "grok" | "deepseek"

const MODEL_PREFIXES: [ModelMark, string[]][] = [
  ["claude", ["claude", "anthropic"]],
  ["openai", ["gpt", "chatgpt", "codex", "openai", "o1", "o3", "o4"]],
  ["gemini", ["gemini", "google"]],
  ["copilot", ["copilot"]],
  ["muse", ["muse"]],
  ["cursor", ["cursor"]],
  ["grok", ["grok"]],
  ["deepseek", ["deepseek"]],
]

const PROVIDERS: Record<string, ModelMark> = {
  anthropic: "claude",
  claude: "claude",
  openai: "openai",
  chatgpt: "openai",
  google: "gemini",
  gemini: "gemini",
  microsoft: "copilot",
  github: "copilot",
  copilot: "copilot",
  muse: "muse",
  cursor: "cursor",
  xai: "grok",
  "x-ai": "grok",
  grok: "grok",
  deepseek: "deepseek",
  "deep-seek": "deepseek",
}

function fromModel(model: string): ModelMark | null {
  // Strip a routing prefix like "anthropic/claude-…" or "openai:gpt-…".
  const routed = model.trim().toLowerCase().match(/^([a-z0-9-]+)[/:](.*)$/)
  const id = routed ? routed[2] : model.trim().toLowerCase()
  for (const [mark, prefixes] of MODEL_PREFIXES) {
    for (const p of prefixes) {
      if (!id.startsWith(p)) continue
      // "o1"/"grok"/"deepseek" must be followed by a separator or end, so "o1x", "ollama" "groking-tool" or "deepseeker" don't match.
      if ((/^o\d$/.test(p) || p === "grok" || p === "deepseek") && id.length > p.length && /[a-z0-9]/.test(id[p.length])) continue
      return mark
    }
  }
  return routed ? PROVIDERS[routed[1]] ?? null : null
}

export function modelMark(model?: string | null, provider?: string | null): ModelMark | null {
  const m = model?.trim()
  if (m && m.toLowerCase() !== "unknown") {
    const hit = fromModel(m)
    if (hit) return hit
  }
  const p = provider?.trim().toLowerCase()
  if (p && p !== "unknown") {
    for (const [key, mark] of Object.entries(PROVIDERS)) if (p.startsWith(key)) return mark
  }
  return null
}
