import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Convex bundles every file under convex/ on its own. Files without "use node" go to the
// default runtime, where node:* modules can't be resolved. Walk each such file's relative
// imports and fail if any reaches a node:* import (e.g. the fact guard's node:fs).

const CONVEX_DIR = resolve(__dirname);

function convexFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "_generated" ? [] : convexFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

const IMPORT_RE = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?from\s+)?["']([^"']+)["']/gm;

function nodeImportChain(file: string, seen = new Set<string>()): string[] | null {
  if (seen.has(file)) return null;
  seen.add(file);
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (spec.startsWith("node:")) return [file, spec];
    if (spec.startsWith(".")) {
      const target = resolveImport(file, spec);
      if (!target) continue;
      const chain = nodeImportChain(target, seen);
      if (chain) return [file, ...chain];
    }
  }
  return null;
}

const isNodeModule = (file: string) => /^\s*(?:\/\/[^\n]*\n\s*)*["']use node["']/.test(readFileSync(file, "utf8"));

describe("Convex runtime split", () => {
  const defaultRuntime = convexFiles(CONVEX_DIR).filter((f) => !isNodeModule(f));

  it.each(defaultRuntime.map((f) => [f.slice(CONVEX_DIR.length + 1), f]))(
    "%s does not pull node:* into the default runtime",
    (_name, file) => {
      expect(nodeImportChain(file)).toBeNull();
    },
  );

  it("tailorFlow.ts is on the Node runtime", () => {
    expect(isNodeModule(join(CONVEX_DIR, "agent/tailorFlow.ts"))).toBe(true);
  });
});
