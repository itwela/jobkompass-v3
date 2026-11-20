/**
 * Model identification labels for the Agent activity page and Settings > CLI keys.
 * The model is the one thing every row should name; when it can't, the UI says "Unknown model"
 * and points at the fix. Pure, so it is unit-tested (modelIdentity.test.ts).
 * Server rule (convex/agent/activityLog.ts resolveModel): key model, else X-Agent-Model, else
 * `model` in the POST /agent/activity body, else "unknown".
 */

export const UNKNOWN_MODEL = "unknown"
export const UNKNOWN_MODEL_LABEL = "Unknown model"
export const NAME_THE_MODEL = "Name the model"
export const MODEL_FIX_CLI = "jk keys create --agent <name> --model <m> --provider <p>"
export const MODEL_FIX_FLAGS = "or run jk with --model <m> (or JK_AGENT_MODEL)"

/** The banner shows once at least this share of rows has no model (and at least BANNER_MIN rows). */
export const UNKNOWN_MODEL_BANNER_SHARE = 0.1
export const UNKNOWN_MODEL_BANNER_MIN = 1

export type ModelSource = "key" | "header" | "body" | "none"

export const isUnknownModel = (model: string | null | undefined) => !model || !model.trim() || model.trim().toLowerCase() === UNKNOWN_MODEL

/** "Unknown model" for a missing model, else the model id as recorded. */
export const modelDisplayName = (model: string | null | undefined) => (isUnknownModel(model) ? UNKNOWN_MODEL_LABEL : model!.trim())

/** Details panel, MODEL SOURCE row. Rows from before model sources fall back on what they show. */
export function modelSourceLabel(r: { model: string; modelSource?: ModelSource; keyName?: string }): string {
  if (r.modelSource === "key") return r.keyName ? `From key "${r.keyName}"` : "From the key"
  if (r.modelSource === "header") return "Sent by the agent (X-Agent-Model)"
  if (r.modelSource === "body") return "Sent in the activity body"
  if (r.modelSource === "none" || isUnknownModel(r.model)) return "Not sent"
  return "Sent by the agent"
}

/** How many rows in the summary have no model. */
export function unknownModelCount(byModel: { model: string; count: number }[]): number {
  return byModel.filter((m) => isUnknownModel(m.model)).reduce((n, m) => n + m.count, 0)
}

/** The quiet banner above the feed: shown when a meaningful share of rows has no model. */
export function showUnknownModelBanner(unknown: number, total: number): boolean {
  if (total <= 0 || unknown < UNKNOWN_MODEL_BANNER_MIN) return false
  return unknown / total >= UNKNOWN_MODEL_BANNER_SHARE
}

export function unknownModelBannerText(unknown: number): string {
  return `${unknown} ${unknown === 1 ? "action has" : "actions have"} no model. Tie a key to an agent and model to fix it.`
}

/** What the nudge on an unknown-model row offers: edit the key it came from, or create a key. */
export function modelFix(r: { model: string; keyId?: string; keyName?: string }): { kind: "none" } | { kind: "key"; keyId: string; label: string } | { kind: "keys"; label: string } {
  if (!isUnknownModel(r.model)) return { kind: "none" }
  if (r.keyId && r.keyName) return { kind: "key", keyId: r.keyId, label: `Add a model to "${r.keyName}"` }
  return { kind: "keys", label: NAME_THE_MODEL }
}

/** Settings > CLI keys: a key with no model gets a muted hint. */
export const keyModelHint = (k: { model?: string } | null | undefined) => (k?.model?.trim() ? null : "No model")
