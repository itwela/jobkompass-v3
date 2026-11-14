import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

// Ceilings only ever go down. Lower them in the commit that removes usages.
export const PALETTE_CEILING = 0;
export const HEX_CEILING = 0;

// Files allowed to hold colour literals (brand SVG art, resume paper previews).
const ALLOWLIST: string[] = [
  "app/global-error.tsx", // renders without the stylesheet
  "app/jk-icons/chatBubble1.tsx", // third-party SVG art
  "app/jk-icons/chatBubble2.tsx",
  "app/jk-icons/googleG.tsx", // Google brand mark
];

const REQUIRED = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "muted", "muted-foreground", "subtle-foreground", "secondary", "secondary-foreground",
  "accent", "accent-foreground", "border", "border-strong", "input", "ring",
  "primary", "primary-foreground", "brand", "plan", "plan-text",
  "bar-1", "bar-2", "bar-3", "bar-4", "ok", "warn", "destructive",
  "status-interested", "status-applied", "status-callback", "status-interviewing",
  "status-offered", "status-rejected", "status-ghosted",
  "sidebar", "sidebar-accent", "sidebar-border", "scrim",
];

function block(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) return "";
  return css.slice(start, css.indexOf("\n}", start));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const PALETTE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|placeholder|caret|accent)-(?:(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)\b/g;
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z])/g;

export function countLiterals() {
  let palette = 0;
  let hex = 0;
  const perFile: Record<string, number> = {};
  for (const f of [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))]) {
    const rel = path.relative(ROOT, f);
    if (ALLOWLIST.includes(rel)) continue;
    const src = fs.readFileSync(f, "utf8");
    const p = (src.match(PALETTE) ?? []).length;
    const h = (src.match(HEX) ?? []).length;
    palette += p;
    hex += h;
    if (p + h) perFile[rel] = p + h;
  }
  return { palette, hex, perFile };
}

describe("design tokens", () => {
  const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

  it("tokens: globals.css defines every variable for both :root and .dark", () => {
    const root = block(css, ":root");
    const dark = block(css, ".dark");
    const missing = REQUIRED.flatMap((n) => [
      ...(root.includes(`--${n}:`) ? [] : [`:root --${n}`]),
      ...(dark.includes(`--${n}:`) ? [] : [`.dark --${n}`]),
    ]);
    expect(missing).toEqual([]);
  });

  it("tokens: every new variable is registered as a Tailwind colour", () => {
    const theme = block(css, "@theme inline");
    const names = ["brand", "plan", "plan-text", "bar-1", "bar-4", "ok", "warn", "subtle-foreground", "border-strong", "status-applied", "scrim"];
    expect(names.filter((n) => !theme.includes(`--color-${n}:`))).toEqual([]);
  });

  it("ratchet: palette classes do not exceed the recorded ceiling", () => {
    expect(countLiterals().palette).toBeLessThanOrEqual(PALETTE_CEILING);
  });

  it("ratchet: hex literals do not exceed the recorded ceiling", () => {
    expect(countLiterals().hex).toBeLessThanOrEqual(HEX_CEILING);
  });
});
