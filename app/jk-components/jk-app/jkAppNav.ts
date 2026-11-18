'use client'

/**
 * The in-app navigation model, shared by the desktop rail (jkSIdebar.tsx), the phone
 * header, the phone menu and the phone tab bar. One list, one place for counts.
 *
 *   const nav = useJkAppNav()
 *   nav.items        -> JkNavItem[] in rail order (My Jobs … Chat), each with a real `count` or null
 *   nav.currentId    -> current mode id, e.g. "/my-jobs"
 *   nav.go(id)       -> switch mode (keeps the provider as the single source of truth)
 *   nav.title(id)    -> short phone-header title ("Documents", "Links" …)
 *   nav.count(id)    -> the count for that mode, or null
 *
 * Tick colours are the four logo bars, one per item, used only for the active item.
 */
import { useCallback, useMemo } from "react";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useJobs } from "@/providers/jkJobsProvider";
import { useJobKompassDocuments } from "@/providers/jkDocumentsProvider";
import { useResources } from "@/providers/jkResourcesProvider";

export type JkModeId =
  | "/my-jobs" | "/documents" | "/interview-prep" | "/performance" | "/resources"
  | "/chat" | "/help" | "/settings";

export interface JkNavItem {
  id: JkModeId;
  label: string;
  /** Short name for the phone header. */
  short: string;
  /** CSS colour of the active tick. */
  tick: string;
  count: number | null;
}

const RAIL: Omit<JkNavItem, "count">[] = [
  { id: "/my-jobs", label: "My Jobs", short: "My Jobs", tick: "var(--bar-1)" },
  { id: "/documents", label: "My Documents", short: "Documents", tick: "var(--bar-2)" },
  { id: "/interview-prep", label: "Interview Prep", short: "Interview Prep", tick: "var(--bar-3)" },
  { id: "/performance", label: "Performance", short: "Performance", tick: "var(--bar-1)" },
  { id: "/resources", label: "Links & Resources", short: "Links", tick: "var(--bar-3)" },
  { id: "/chat", label: "Chat", short: "Chat", tick: "var(--bar-2)" },
];

const OTHER: Record<string, string> = { "/help": "Help & Guides", "/settings": "Settings" };

/** Phone tab bar: the three places people live, plus More (opens the menu). */
export const JK_TABS: { id: JkModeId | "more"; label: string; tick: string }[] = [
  { id: "/my-jobs", label: "Jobs", tick: "var(--bar-1)" },
  { id: "/documents", label: "Docs", tick: "var(--bar-2)" },
  { id: "/chat", label: "Chat", tick: "var(--bar-3)" },
  { id: "more", label: "More", tick: "var(--bar-4)" },
];

/** Modes that get the logo in the phone header; everything else gets a back arrow. */
export const JK_TOP_LEVEL: string[] = ["/my-jobs", "/documents", "/chat"];

export function useJkAppNav() {
  const { currentMode, setCurrentMode, allModes } = useJobKompassChatWindow();
  const { allJobs, jobs } = useJobs();
  const { documents, isLoading: docsLoading } = useJobKompassDocuments();
  const { resources } = useResources();

  const counts = useMemo<Record<string, number | null>>(() => ({
    "/my-jobs": jobs === undefined ? null : allJobs.length,
    "/documents": docsLoading ? null : documents.length,
    "/resources": Array.isArray(resources) ? resources.length : null,
  }), [jobs, allJobs.length, docsLoading, documents.length, resources]);

  const items: JkNavItem[] = useMemo(
    // The rail shows counts for jobs and documents only (as the frames do).
    () => RAIL.map((r) => ({ ...r, count: r.id === "/my-jobs" || r.id === "/documents" ? counts[r.id] ?? null : null })),
    [counts],
  );

  const go = useCallback((id: string) => {
    const mode = allModes.find((m) => m.id === id);
    if (mode) setCurrentMode(mode);
  }, [allModes, setCurrentMode]);

  const title = useCallback((id: string) => RAIL.find((r) => r.id === id)?.short ?? OTHER[id] ?? currentMode.name, [currentMode.name]);
  const count = useCallback((id: string) => counts[id] ?? null, [counts]);

  return { items, currentId: currentMode.id, go, title, count };
}

/** "itwela ibomu" -> "II". */
export function jkInitials(name?: string | null, fallback?: string | null) {
  const src = (name || fallback || "").trim();
  if (!src) return "?";
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

/** Badge text for a paid plan, or null for free. Gold is only ever used for these. */
export function jkPlanBadge(planId?: string | null, status?: string | null) {
  if (!planId || planId === "free") return null;
  if (status === "canceled") return { label: "RENEW", paid: false };
  const base = planId.replace("-annual", "");
  return { label: base.toUpperCase(), paid: true };
}
