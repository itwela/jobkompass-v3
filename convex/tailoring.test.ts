import { describe, expect, it } from "vitest";
import { tailoringValidator } from "./tailoring";
import { scoreMustHaves } from "../lib/chat/mustHaves";

type V = { kind: string; isOptional?: string; fields?: Record<string, V>; element?: V; members?: V[] };

/** Minimal structural check mirroring Convex's arg validation: rejects extra/missing fields and wrong kinds. */
function conforms(val: any, v: V, path = ""): string | null {
  if (val === undefined) return v.isOptional === "optional" ? null : `${path} missing`;
  switch (v.kind) {
    case "object": {
      if (typeof val !== "object" || val === null || Array.isArray(val)) return `${path} not object`;
      for (const k of Object.keys(val)) if (!(k in v.fields!)) return `${path}.${k} extra field`;
      for (const [k, fv] of Object.entries(v.fields!)) {
        const err = conforms(val[k], fv, `${path}.${k}`);
        if (err) return err;
      }
      return null;
    }
    case "array":
      if (!Array.isArray(val)) return `${path} not array`;
      for (let i = 0; i < val.length; i++) {
        const err = conforms(val[i], v.element!, `${path}[${i}]`);
        if (err) return err;
      }
      return null;
    case "string":
    case "id":
      return typeof val === "string" ? null : `${path} not string`;
    case "number":
    case "float64":
      return typeof val === "number" ? null : `${path} not number`;
    case "boolean":
      return typeof val === "boolean" ? null : `${path} not boolean`;
    default:
      return null;
  }
}

describe("tailoringValidator", () => {
  it("accepts mustHaves.matched with {term, evidence}", () => {
    const mh = (tailoringValidator as any).fields.mustHaves as V;
    expect(Object.keys(mh.fields!)).toContain("matched");

    const tailoring = {
      jobId: "j1",
      jobTitle: "Engineer",
      jobCompany: "Acme",
      baseResumeId: "r1",
      baseResumeName: "Base",
      pages: 1,
      changes: [{ section: "skills", title: "Skills", note: "x" }],
      marks: { summary: true, skills: true, experience: [0], projects: [] },
      mustHaves: { total: 2, met: ["React"], missing: ["Kubernetes"], matched: [{ term: "React", evidence: "Built React apps" }] },
    };
    expect(conforms(tailoring, tailoringValidator as any)).toBeNull();
  });

  it("accepts the real mustHaveCoverage output", () => {
    const cov = scoreMustHaves(["React", "Kubernetes"], {
      skills: { languages: ["TypeScript"], frameworks: ["React"] },
      experience: [{ title: "Eng", company: "X", description: "Built React dashboards" }],
    });
    expect(cov.matched!.length).toBeGreaterThan(0);
    expect(conforms({ changes: [], mustHaves: cov }, tailoringValidator as any)).toBeNull();
  });
});
