import { describe, expect, it } from "vitest"
import {
  MODEL_FIX_CLI, UNKNOWN_MODEL_LABEL, isUnknownModel, keyModelHint, modelDisplayName, modelFix, modelSourceLabel,
  showUnknownModelBanner, unknownModelBannerText, unknownModelCount,
} from "./modelIdentity"

describe("isUnknownModel / modelDisplayName", () => {
  it.each([["unknown", true], ["Unknown", true], ["", true], ["  ", true], [undefined, true], [null, true], ["gpt-5", false]])("%s -> %s", (m, want) => {
    expect(isUnknownModel(m as string)).toBe(want)
  })
  it("labels", () => {
    expect(modelDisplayName("unknown")).toBe(UNKNOWN_MODEL_LABEL)
    expect(modelDisplayName("claude-opus-5-5")).toBe("claude-opus-5-5")
  })
})

describe("modelSourceLabel", () => {
  it("each source", () => {
    expect(modelSourceLabel({ model: "m", modelSource: "key", keyName: "laptop" })).toBe('From key "laptop"')
    expect(modelSourceLabel({ model: "m", modelSource: "key" })).toBe("From the key")
    expect(modelSourceLabel({ model: "m", modelSource: "header" })).toBe("Sent by the agent (X-Agent-Model)")
    expect(modelSourceLabel({ model: "m", modelSource: "body" })).toBe("Sent in the activity body")
    expect(modelSourceLabel({ model: "unknown", modelSource: "none" })).toBe("Not sent")
  })
  it("legacy rows with no source", () => {
    expect(modelSourceLabel({ model: "unknown" })).toBe("Not sent")
    expect(modelSourceLabel({ model: "gpt-5" })).toBe("Sent by the agent")
  })
})

describe("unknown-model banner", () => {
  const byModel = [{ model: "opus", count: 18 }, { model: "unknown", count: 2 }]
  it("counts unknown rows", () => {
    expect(unknownModelCount(byModel)).toBe(2)
    expect(unknownModelCount([{ model: "opus", count: 3 }])).toBe(0)
  })
  it("threshold is 10% of rows", () => {
    expect(showUnknownModelBanner(2, 20)).toBe(true)
    expect(showUnknownModelBanner(1, 20)).toBe(false)
    expect(showUnknownModelBanner(1, 10)).toBe(true)
    expect(showUnknownModelBanner(5, 5)).toBe(true)
  })
  it("never on zero", () => {
    expect(showUnknownModelBanner(0, 10)).toBe(false)
    expect(showUnknownModelBanner(0, 0)).toBe(false)
  })
  it("text", () => {
    expect(unknownModelBannerText(1)).toBe("1 action has no model. Tie a key to an agent and model to fix it.")
    expect(unknownModelBannerText(4)).toBe("4 actions have no model. Tie a key to an agent and model to fix it.")
  })
})

describe("modelFix (row nudge)", () => {
  it("known model: no nudge", () => {
    expect(modelFix({ model: "opus", keyId: "k", keyName: "laptop" })).toEqual({ kind: "none" })
  })
  it("unknown model, live key: edit that key", () => {
    expect(modelFix({ model: "unknown", keyId: "k", keyName: "laptop" })).toEqual({ kind: "key", keyId: "k", label: 'Add a model to "laptop"' })
  })
  it("unknown model, revoked or unrecorded key: open CLI keys", () => {
    expect(modelFix({ model: "unknown", keyId: "k" })).toEqual({ kind: "keys", label: "Name the model" })
    expect(modelFix({ model: "unknown" })).toEqual({ kind: "keys", label: "Name the model" })
  })
  it("the CLI hint is exact", () => {
    expect(MODEL_FIX_CLI).toBe("jk keys create --agent <name> --model <m> --provider <p>")
  })
})

describe("keyModelHint", () => {
  it("no model -> hint", () => {
    expect(keyModelHint(null)).toBe("No model")
    expect(keyModelHint({ model: " " })).toBe("No model")
    expect(keyModelHint({ model: "opus" })).toBeNull()
  })
})
