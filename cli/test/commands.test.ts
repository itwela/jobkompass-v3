import { describe, expect, it } from "vitest";
import { commands, parseList } from "../src/commands";

const find = (name: string) => commands.find((c) => c.name === name);

describe("resume question commands", () => {
  it("registers questions, answer and tailor against the right routes", () => {
    expect(find("resumes questions")).toMatchObject({ method: "GET", path: "/agent/resumes/questions" });
    expect(find("resumes answer")).toMatchObject({ method: "POST", path: "/agent/resumes/answers" });
    expect(find("resumes tailor")).toMatchObject({ method: "POST", path: "/agent/resumes/tailor" });
  });

  it("tailor takes an optional --instructions", () => {
    const opt = find("resumes tailor")!.opts.find((o) => o.api === "instructions");
    expect(opt).toMatchObject({ flag: "--instructions <text>", type: "str" });
    expect(opt).not.toHaveProperty("required", true);
  });

  it("add and update take --job and --ai-questions", () => {
    for (const name of ["resumes add", "resumes update"]) {
      const apis = find(name)!.opts.map((o) => o.api);
      expect(apis).toContain("jobId");
      expect(apis).toContain("aiQuestions");
    }
  });

  it("answer requires id and json answers", () => {
    const opts = find("resumes answer")!.opts;
    expect(opts.find((o) => o.api === "answers")).toMatchObject({ type: "json", required: true });
    expect(opts.find((o) => o.api === "id")).toMatchObject({ required: true });
  });

  it("has no duplicate command names or duplicate flags", () => {
    const names = commands.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of commands) {
      const flags = c.opts.map((o) => o.flag.split(" ")[0]);
      expect(new Set(flags).size).toBe(flags.length);
    }
  });
});

describe("folder commands", () => {
  it("registers folders list and resumes move against the right routes", () => {
    expect(find("folders list")).toMatchObject({ method: "GET", path: "/agent/folders" });
    expect(find("resumes move")).toMatchObject({ method: "POST", path: "/agent/resumes/move" });
  });

  it("resumes move maps flags to the API params", () => {
    const opts = find("resumes move")!.opts;
    const by = (api: string) => opts.find((o) => o.api === api);
    expect(by("folder")).toMatchObject({ flag: "--folder <name|id>", type: "str", required: true });
    expect(by("resumeIds")).toMatchObject({ flag: "--ids <ids>", type: "list" });
    expect(by("allExceptFavorites")).toMatchObject({ flag: "--all-except-favorites", type: "bool" });
    expect(by("dryRun")).toMatchObject({ flag: "--dry-run", type: "bool" });
    expect(by("confirm")).toMatchObject({ flag: "--yes", type: "bool" });
  });

  it("resumes move is not a generic confirm command (the server dry-runs bulk without --yes)", () => {
    expect(find("resumes move")!.confirm).toBeUndefined();
  });

  it("parseList splits comma ids, trims, drops empties and duplicates", () => {
    expect(parseList("a, b,,c ,a")).toEqual(["a", "b", "c"]);
    expect(parseList("")).toEqual([]);
  });
});
