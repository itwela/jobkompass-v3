import { describe, expect, it } from "vitest";
import { commands } from "../src/commands";

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
