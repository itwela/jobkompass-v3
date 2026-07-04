import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Prod convex.site URL — confirmed against `npx convex deploy` output in Task 8.
export const DEFAULT_BASE_URL = "https://proficient-mammoth-632.convex.site";

function configDir(): string {
  return process.env.JK_CONFIG_DIR ?? join(homedir(), ".config", "jk");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export type CliConfig = { apiKey?: string; baseUrl: string };

export function loadConfig(): CliConfig {
  let fileCfg: { apiKey?: string; baseUrl?: string } = {};
  if (existsSync(configPath())) {
    try {
      fileCfg = JSON.parse(readFileSync(configPath(), "utf8"));
    } catch {
      // Corrupt config: ignore, env vars can still work.
    }
  }
  return {
    apiKey: process.env.JK_API_KEY ?? fileCfg.apiKey,
    baseUrl: process.env.JK_BASE_URL ?? fileCfg.baseUrl ?? DEFAULT_BASE_URL,
  };
}

export function saveConfig(cfg: { apiKey?: string; baseUrl?: string }): void {
  mkdirSync(configDir(), { recursive: true });
  const existing = existsSync(configPath()) ? JSON.parse(readFileSync(configPath(), "utf8")) : {};
  writeFileSync(configPath(), JSON.stringify({ ...existing, ...cfg }, null, 2) + "\n", { mode: 0o600 });
}

export function deleteConfig(): void {
  rmSync(configPath(), { force: true });
}
