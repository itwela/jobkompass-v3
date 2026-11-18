import { describe, expect, it, vi } from "vitest";
import { agentTailor, type AgentTailorDeps } from "./tailorFlow";

const content = { personalInfo: { firstName: "Ada", lastName: "L" }, experience: [] };
const rows: Record<string, any> = {
  base1: { _id: "base1", name: "Base", content, template: "joseph", bulletAnswers: [{ section: "experience", index: 0, bullet: "x", answer: "40" }] },
  tailored1: { _id: "tailored1", name: "Tailored", content: { ...content, x: 1 }, tailoredFrom: { baseResumeId: "base1", jobId: "jobOld" } },
  orphan: { _id: "orphan", content, tailoring: { baseResumeId: "gone", changes: [] } },
};
const job = { _id: "job1", title: "Engineer", company: "Globex", description: "d", skills: ["React"] };

function deps(over: Partial<AgentTailorDeps> = {}) {
  const tailor = vi.fn(async () => ({ resumeId: "new1", storageId: "s1", displayName: "Ada L — Globex — Engineer" }) as any);
  const setJobResumeUsed = vi.fn(async () => undefined);
  const spendAi = vi.fn(async () => undefined);
  const d: AgentTailorDeps = {
    getResume: async (id) => {
      if (!rows[id]) throw new Error("Resume not found");
      return rows[id];
    },
    getJob: async () => job,
    settings: async () => ({ resumePreferences: ["Keep it to one page"], defaultTemplate: "mar", rank: 3 }),
    canGenerate: async () => ({ allowed: true }),
    spendAi,
    store: {} as any,
    setJobResumeUsed,
    fileUrl: async () => "https://file",
    tailor: tailor as any,
    ...over,
  };
  return { d, tailor, setJobResumeUsed, spendAi };
}

describe("agentTailor", () => {
  it("passes saved preferences plus the one-off instruction, and defaults to the account template", async () => {
    const { d, tailor, setJobResumeUsed } = deps();
    const out = await agentTailor(d, { base: "base1" as any, jobId: "job1" as any, instructions: " lead with data " });
    const input = (tailor.mock.calls[0] as any)[1];
    expect(input.instructions).toEqual(["Keep it to one page", "lead with data"]);
    expect(input.templateId).toBe("mar");
    expect(input.premium).toBe(true);
    expect(input.baseResume).toMatchObject({ _id: "base1", name: "Base", bulletAnswers: rows.base1.bulletAnswers });
    expect(input.job).toMatchObject({ _id: "job1", title: "Engineer", company: "Globex", skills: ["React"] });
    expect(setJobResumeUsed).toHaveBeenCalledWith("job1", "Ada L — Globex — Engineer");
    expect(out.fileUrl).toBe("https://file");
  });

  it("keeps the old request shape working and honors an explicit template", async () => {
    const { d, tailor } = deps({ settings: async () => ({ resumePreferences: [], defaultTemplate: null, rank: 3 }) });
    await agentTailor(d, { base: "base1" as any, jobId: "job1" as any });
    expect((tailor.mock.calls[0] as any)[1].templateId).toBe("joseph");
    expect((tailor.mock.calls[0] as any)[1].instructions).toEqual([]);
    await agentTailor(d, { base: "base1" as any, jobId: "job1" as any, template: "jake" });
    expect((tailor.mock.calls[1] as any)[1].templateId).toBe("jake");
  });

  it("lets preferences replace the saved ones and rejects a non-array", async () => {
    const { d, tailor } = deps();
    await agentTailor(d, { base: "base1" as any, jobId: "job1" as any, preferences: ["No summary"] });
    expect((tailor.mock.calls[0] as any)[1].instructions).toEqual(["No summary"]);
    await expect(agentTailor(d, { base: "base1" as any, jobId: "job1" as any, preferences: "nope" as any })).rejects.toThrow(
      /preferences must be a JSON array/
    );
  });

  it("resolves an already-tailored base to its original and that resume's answers", async () => {
    const { d, tailor } = deps();
    const out = await agentTailor(d, { base: "tailored1" as any, jobId: "job1" as any });
    expect(out.base).toBe("base1");
    expect((tailor.mock.calls[0] as any)[1].baseResume).toMatchObject({ _id: "base1", content, bulletAnswers: rows.base1.bulletAnswers });
  });

  it("rejects clearly when the original base is gone, before spending anything", async () => {
    const { d, tailor, spendAi } = deps();
    await expect(agentTailor(d, { base: "orphan" as any, jobId: "job1" as any })).rejects.toThrow(/no longer saved/);
    expect(spendAi).not.toHaveBeenCalled();
    expect(tailor).not.toHaveBeenCalled();
  });

  it("stops at the monthly limit before spending a model call", async () => {
    const { d, spendAi } = deps({ canGenerate: async () => ({ allowed: false, used: 5, limit: 5 }) });
    await expect(agentTailor(d, { base: "base1" as any, jobId: "job1" as any })).rejects.toThrow(/Limit reached/);
    expect(spendAi).not.toHaveBeenCalled();
  });

  it("still returns when setting the job's resumeUsed fails", async () => {
    const { d } = deps({ setJobResumeUsed: async () => Promise.reject(new Error("x")) });
    await expect(agentTailor(d, { base: "base1" as any, jobId: "job1" as any })).resolves.toBeTruthy();
  });
});
