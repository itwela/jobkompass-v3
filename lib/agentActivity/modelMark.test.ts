import { describe, expect, it } from "vitest"
import { modelMark } from "./modelMark"

describe("modelMark", () => {
  it("maps Claude models and Anthropic", () => {
    expect(modelMark("claude-opus-5-5")).toBe("claude")
    expect(modelMark("claude-sonnet-4-5")).toBe("claude")
    expect(modelMark("Claude-Haiku")).toBe("claude")
    expect(modelMark("anthropic/claude-3-5")).toBe("claude")
    expect(modelMark("unknown", "Anthropic")).toBe("claude")
  })
  it("maps OpenAI models", () => {
    for (const m of ["gpt-5", "GPT-4o", "o1", "o3-mini", "o4-mini", "chatgpt-4o-latest", "codex-mini", "openai/gpt-4.1"]) expect(modelMark(m)).toBe("openai")
    expect(modelMark("", "OpenAI")).toBe("openai")
    expect(modelMark("ollama-thing")).toBeNull()
    expect(modelMark("o10x")).toBeNull()
  })
  it("maps Gemini and Google", () => {
    expect(modelMark("gemini-2.5-pro")).toBe("gemini")
    expect(modelMark("x", "Google")).toBe("gemini")
  })
  it("maps Copilot and Microsoft", () => {
    expect(modelMark("copilot-chat")).toBe("copilot")
    expect(modelMark(undefined, "Microsoft")).toBe("copilot")
  })
  it("maps Muse and Cursor", () => {
    expect(modelMark("muse-spark")).toBe("muse")
    expect(modelMark("cursor-small")).toBe("cursor")
  })
  it("returns null for unknown, empty and marks the landing does not have", () => {
    expect(modelMark("unknown", "unknown")).toBeNull()
    expect(modelMark("", "")).toBeNull()
    expect(modelMark(undefined, null)).toBeNull()
    expect(modelMark("llama-3.1-70b", "Meta")).toBeNull()
    expect(modelMark("mistral-large", "Mistral")).toBeNull()
    expect(modelMark("grok-4", "xAI")).toBeNull()
  })
  it("prefers the model over the provider", () => {
    expect(modelMark("gpt-5", "Anthropic")).toBe("openai")
  })
})
