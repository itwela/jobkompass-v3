import { Command } from "commander";
import { commands, type CommandSpec, type OptSpec } from "./commands";
import { apiRequest, CliError } from "./client";
import { emit } from "./output";
import { resolveDate } from "./dates";
import { configPath, deleteConfig, loadConfig, saveConfig } from "./config";

const program = new Command();
program
  .name("jk")
  .description("Agent-first CLI for JobKompass. All output is JSON when piped; add --json to force it.")
  .option("--json", "Force JSON output")
  .version("0.1.0");

function coerceOpt(spec: OptSpec, raw: unknown): unknown {
  if (raw === undefined) return undefined;
  switch (spec.type) {
    case "num": {
      const n = Number(raw);
      if (Number.isNaN(n)) fatal("invalid_option", `Option ${spec.flag.split(" ")[0]} must be a number, got '${raw}'`, undefined, 1);
      return n;
    }
    case "bool":
      return true; // value-less flag
    case "json":
      try {
        return JSON.parse(String(raw));
      } catch {
        fatal("invalid_option", `Option ${spec.flag.split(" ")[0]} must be valid JSON`, `Example: '${spec.desc ?? "[...]"}'`, 1);
      }
      break;
    case "date":
      try {
        return resolveDate(String(raw));
      } catch (err) {
        fatal("invalid_option", err instanceof Error ? err.message : String(err), undefined, 1);
      }
      break;
    default:
      return raw;
  }
}

function fatal(code: string, message: string, hint: string | undefined, exitCode: number): never {
  const err = { ok: false, error: { code, message, ...(hint ? { hint } : {}) } };
  if (process.stderr.isTTY) {
    process.stderr.write(`error (${code}): ${message}\n${hint ? `hint: ${hint}\n` : ""}`);
  } else {
    process.stderr.write(JSON.stringify(err) + "\n");
  }
  process.exit(exitCode);
}

function register(spec: CommandSpec): void {
  const [noun, verb] = spec.name.split(" ");
  let parent = program.commands.find((c) => c.name() === noun);
  if (!parent) {
    parent = program.command(noun).description(`${noun} commands`);
  }
  const cmd = parent.command(verb).description(spec.desc);
  for (const opt of spec.opts) {
    const desc = opt.desc ?? "";
    if (opt.required) cmd.requiredOption(opt.flag, desc, opt.default);
    else cmd.option(opt.flag, desc, opt.default);
  }
  if (spec.confirm) cmd.option("--yes", "Confirm this destructive action");
  cmd.action(async (options: Record<string, unknown>) => {
    if (spec.confirm && !options.yes) {
      fatal("confirm_required", `'jk ${spec.name}' is destructive.`, `Re-run with --yes to confirm.`, 1);
    }
    const payload: Record<string, unknown> = {};
    for (const opt of spec.opts) {
      // commander camelCases flags: "--date <date>" -> options.date
      const flagName = opt.flag.split(" ")[0].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = coerceOpt(opt, options[flagName]);
      if (value !== undefined) payload[opt.api] = value;
    }
    try {
      const data =
        spec.method === "GET" || spec.method === "DELETE"
          ? await apiRequest(spec.method, spec.path, { query: payload })
          : await apiRequest(spec.method, spec.path, { body: payload });
      emit(data, { json: Boolean(program.opts().json) });
    } catch (err) {
      if (err instanceof CliError) fatal(err.code, err.message, err.hint, err.exitCode);
      throw err;
    }
  });
}

for (const spec of commands) register(spec);

// ---- auth ----
const auth = program.command("auth").description("Manage the API key");
auth
  .command("login <key>")
  .description("Save the API key to " + configPath())
  .action(async (key: string) => {
    saveConfig({ apiKey: key });
    try {
      const data = await apiRequest("GET", "/agent/ping");
      emit({ saved: true, ...(data as object) }, { json: Boolean(program.opts().json) });
    } catch (err) {
      deleteConfig();
      if (err instanceof CliError) fatal(err.code, `Key rejected: ${err.message}`, err.hint, err.exitCode);
      throw err;
    }
  });
auth
  .command("status")
  .description("Verify the configured key")
  .action(async () => {
    try {
      const data = await apiRequest("GET", "/agent/ping");
      emit({ authenticated: true, baseUrl: loadConfig().baseUrl, ...(data as object) }, { json: Boolean(program.opts().json) });
    } catch (err) {
      if (err instanceof CliError) fatal(err.code, err.message, err.hint, err.exitCode);
      throw err;
    }
  });
auth
  .command("logout")
  .description("Delete the stored key")
  .action(() => {
    deleteConfig();
    emit({ loggedOut: true }, { json: Boolean(program.opts().json) });
  });

// ---- schema ----
program
  .command("schema")
  .description("Full machine-readable API surface (teach an agent everything in one call)")
  .action(async () => {
    try {
      const data = await apiRequest("GET", "/agent/schema");
      emit(data, { json: true });
    } catch (err) {
      if (err instanceof CliError) fatal(err.code, err.message, err.hint, err.exitCode);
      throw err;
    }
  });

program.parseAsync(process.argv);
