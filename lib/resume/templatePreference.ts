/**
 * Which resume/cover-letter template the user last generated with.
 *
 * Pure on purpose: the component owns all localStorage access and passes the raw
 * stored value in, so this logic is testable without a DOM.
 */
// Relative, not `@/lib/templates`: no root vitest config maps the `@/` alias, and every
// tested file under lib/ imports relatively. Type-only, so nothing is emitted at runtime.
import type { TemplateType } from '../templates';

export interface ResolvedTemplateSelection {
  /** Template id to pre-select when the modal opens. */
  templateId: string;
  /** True only when the id came from a stored preference, not the fallback. Drives the "Last used" chip. */
  wasRemembered: boolean;
}

export function templatePreferenceKey(type: TemplateType): string {
  return `jk:lastTemplateId:${type}`;
}

/**
 * A stored id is only honored if it is still in the current allowlist. This is required,
 * not defensive padding: `mar` previously identified the template now called `joseph`, and
 * skeleton templates (vertex/minimal/executive/momentum) were removed outright — so browsers
 * hold ids that must no longer resolve.
 */
export function resolveInitialTemplateId(
  storedId: string | null | undefined,
  availableIds: string[],
  fallbackId: string,
): ResolvedTemplateSelection {
  if (storedId && availableIds.includes(storedId)) {
    return { templateId: storedId, wasRemembered: true };
  }
  return { templateId: fallbackId, wasRemembered: false };
}
