import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tailorResume", () => ({ tailorResume: vi.fn() }));
vi.mock("../chat/mustHaves", async (orig) => ({
  ...(await orig<typeof import("../chat/mustHaves")>()),
  mustHavesForJob: vi.fn(async () => ["React", "Kubernetes"]),
  countPdfPages: vi.fn(async () => 1),
}));

import { tailorResume } from "./tailorResume";
import {
  originalBaseId,
  pickTailorTemplate,
  pickTailorTemplateWithNotice,
  tailorAndSaveWith,
  tailorInstructions,
  TailorFailedError,
  type TailorStore,
} from "./tailorCore";

const base = {
  personalInfo: { firstName: "Ada", lastName: "Lovelace", email: "a@b.c" },
  experience: [{ company: "Acme", title: "Engineer", date: "2022", details: ["Built the API in React"] }],
  skills: { technical: ["React"] },
};
const tailoredContent = {
  ...base,
  experience: [{ company: "Acme", title: "Engineer", date: "2022", details: ["Built the React API used by 200 teams"] }],
};

function fakeStore(): TailorStore & { calls: Record<string, any[]> } {
  const calls: Record<string, any[]> = {};
  const log = (k: string) => (arg: any) => {
    (calls[k] ??= []).push(arg);
  };
  return {
    calls,
    saveAnswers: vi.fn(async (id, a) => log("saveAnswers")({ id, a })),
    renderPdf: vi.fn(async (content, t) => {
      log("renderPdf")({ content, t });
      return new Uint8Array([1, 2, 3, 4]);
    }),
    storePdf: vi.fn(async () => "storage1" as any),
    insertResume: vi.fn(async (row) => {
      log("insertResume")(row);
      return "resume1" as any;
    }),
    setTailorMeta: vi.fn(async (meta) => log("setTailorMeta")(meta)),
  };
}

describe("tailorInstructions", () => {
  it("puts saved preferences first, then the trimmed one-off instruction", () => {
    expect(tailorInstructions(["One page"], "  lead with data  ")).toEqual(["One page", "lead with data"]);
    expect(tailorInstructions(null, "")).toEqual([]);
    expect(tailorInstructions(["a", 3, "b"], undefined)).toEqual(["a", "b"]);
  });
});

describe("pickTailorTemplateWithNotice", () => {
  it("swaps an explicit template above the plan for jake, with the notice", () => {
    expect(pickTailorTemplateWithNotice({ explicit: "mar", rank: 0 })).toEqual({
      template: "jake",
      notice: "Your plan doesn't include mar; used jake instead. Upgrade to use it.",
    });
  });
  it("leaves allowed, defaulted and unknown picks alone", () => {
    expect(pickTailorTemplateWithNotice({ explicit: "mar", rank: 3 })).toEqual({ template: "mar" });
    expect(pickTailorTemplateWithNotice({ baseTemplate: "mar", rank: 0 })).toEqual({ template: "jake" });
    expect(pickTailorTemplateWithNotice({ explicit: "nope", rank: 0 })).toEqual({ template: "nope" });
  });
});

describe("pickTailorTemplate", () => {
  it("honors an explicit template, then the account default, then the base's, then jake", () => {
    expect(pickTailorTemplate({ explicit: "mar", accountDefault: "joseph", baseTemplate: "jake", rank: 3 })).toBe("mar");
    expect(pickTailorTemplate({ accountDefault: "joseph", baseTemplate: "mar", rank: 3 })).toBe("joseph");
    expect(pickTailorTemplate({ accountDefault: null, baseTemplate: "jake", rank: 0 })).toBe("jake");
    expect(pickTailorTemplate({ rank: 0 })).toBe("jake");
  });

  it("drops a base template above the plan", () => {
    expect(pickTailorTemplate({ baseTemplate: "not-a-template", rank: 0 })).toBe("jake");
  });
});

describe("originalBaseId", () => {
  it("reads tailoredFrom, then tailoring", () => {
    expect(originalBaseId({ tailoredFrom: { baseResumeId: "b1" as any } })).toBe("b1");
    expect(originalBaseId({ tailoring: { baseResumeId: "b2" as any } })).toBe("b2");
    expect(originalBaseId({})).toBeUndefined();
  });
});

describe("tailorAndSaveWith", () => {
  beforeEach(() => vi.mocked(tailorResume).mockReset());

  it("saves the app's name, tailoring record and pending questions", async () => {
    vi.mocked(tailorResume).mockResolvedValue({
      resume: tailoredContent,
      questions: [{ id: "q1", section: "experience", index: 0, bullet: "b", question: "How many?" }],
      model: "m",
    } as any);
    const store = fakeStore();
    const out = await tailorAndSaveWith(store, {
      baseResume: { _id: "base1" as any, name: "Base", content: base, bulletAnswers: [] },
      job: { _id: "job1" as any, title: "Frontend Engineer", company: "Globex", description: "x" },
      templateId: "mar",
      premium: true,
      instructions: ["One page", "lead with data"],
    });

    expect(vi.mocked(tailorResume).mock.calls[0][0].instructions).toEqual(["One page", "lead with data"]);
    expect(store.calls.renderPdf[0].t).toBe("mar");
    const row = store.calls.insertResume[0];
    expect(row.name).toBe("Ada Lovelace — Globex — Frontend Engineer");
    expect(row.fileName).toBe("Ada-Lovelace-Globex-Resume.pdf");
    expect(row.template).toBe("mar");
    expect(row.fileSize).toBe(4);
    expect(row.tailoring).toMatchObject({
      jobId: "job1",
      jobTitle: "Frontend Engineer",
      jobCompany: "Globex",
      baseResumeId: "base1",
      baseResumeName: "Base",
      pages: 1,
      mustHaves: { total: 2, met: ["React"], missing: ["Kubernetes"] },
    });
    expect(row.tailoring.marks.experience).toEqual([0]);
    expect(store.calls.setTailorMeta[0]).toMatchObject({
      resumeId: "resume1",
      tailoredFrom: { baseResumeId: "base1", jobId: "job1" },
      pendingQuestions: [{ id: "q1", question: "How many?" }],
    });
    expect(out.displayName).toBe(row.name);
    expect(out.pages).toBe(1);
  });

  it("throws TailorFailedError and saves nothing when the writer fails", async () => {
    vi.mocked(tailorResume).mockResolvedValue(null as any);
    const store = fakeStore();
    await expect(
      tailorAndSaveWith(store, { baseResume: { content: base }, job: { title: "a", company: "b" }, templateId: "jake", premium: true })
    ).rejects.toBeInstanceOf(TailorFailedError);
    expect(store.calls.insertResume).toBeUndefined();
  });
});
