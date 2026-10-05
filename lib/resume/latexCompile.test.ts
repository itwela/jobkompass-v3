import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  exportRouteFailureDetails,
  latexCompileFailureReport,
  latexCompileRequestBody,
  latexServiceFailureMessage,
} from "./latexCompile";

const MINIMAL_TEX = "\\documentclass{article}\\begin{document}Hello\\end{document}";

/** Call sites that POST to the remote LaTeX compiler. */
const COMPILE_CALLERS = [
  "app/api/resume/export/[templateId]/route.ts",
  "app/api/coverletter/export/jake/route.ts",
  "app/api/free-resume/generate/route.ts",
  "app/ai/tools/file.ts",
];

describe("latexCompileRequestBody", () => {
  it("sends latexContent so the documented Cloud Run service does not 400", () => {
    const body = latexCompileRequestBody(MINIMAL_TEX, "resume-abc");

    // LATEX_SERVICE_SETUP.md: const { latexContent } = req.body; if (!latexContent) 400
    expect(body.latexContent).toBe(MINIMAL_TEX);
    expect(body.latex).toBe(MINIMAL_TEX);
    expect(body.filename).toBe("resume-abc");
  });

  it("rejects the old export body that sent only latex", () => {
    const oldExportBody: { latex: string; filename: string; latexContent?: string } = {
      latex: MINIMAL_TEX,
      filename: "resume-abc",
    };

    expect(oldExportBody.latexContent).toBeUndefined();
    expect(latexCompileRequestBody(MINIMAL_TEX, "resume-abc").latexContent).toBeTruthy();
  });
});

describe("compile callers", () => {
  it("builds every /compile body with latexCompileRequestBody", () => {
    for (const rel of COMPILE_CALLERS) {
      const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(source, rel).toContain("/compile");
      expect(source, rel).toContain("latexCompileRequestBody(");
      expect(source, rel).not.toMatch(/JSON\.stringify\(\s*\{[^}]*\blatex\s*:/);
    }
  });

  it("turns a blank compile log into details on resume and cover letter export", () => {
    for (const rel of [
      "app/api/resume/export/[templateId]/route.ts",
      "app/api/coverletter/export/jake/route.ts",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(source, rel).toContain("latexCompileFailureReport(");
      expect(source, rel).toContain("details");
    }
  });
});

describe("failure text", () => {
  it("prefers the service log over the generic error string", () => {
    expect(
      latexServiceFailureMessage(
        { error: "PDF generation failed", log: "! LaTeX Error: File `glyphtounicode.tex' not found." },
        "Internal Server Error"
      )
    ).toContain("glyphtounicode");
  });

  it("names the status when the compile log is blank", () => {
    const railway404 = { status: "error", code: 404, message: "Application not found", log: "", error: undefined };
    const report = latexCompileFailureReport(railway404, 404, "Not Found");

    expect(report.log).toBe("");
    expect(report.details).toBe("HTTP 404: empty body / Application not found");
    expect(latexServiceFailureMessage(railway404, "Not Found", 404)).toBe(report.details);
  });

  it("uses the same hint for an empty JSON body", () => {
    expect(latexCompileFailureReport({}, 404, "Not Found").details).toBe(
      "HTTP 404: empty body / Application not found"
    );
  });

  it("keeps a real service error when the log is blank and the status is not a missing app", () => {
    expect(latexCompileFailureReport({ error: "latexContent is required" }, 400, "Bad Request").details).toBe(
      "HTTP 400: empty body / Application not found — latexContent is required"
    );
  });

  it("forwards a blank export log into agent details", () => {
    expect(
      exportRouteFailureDetails({
        error: "LaTeX compilation failed",
        log: "",
      })
    ).toBe("non-OK: empty body / Application not found");
    expect(
      exportRouteFailureDetails({
        error: "LaTeX compilation failed",
        log: "",
        details: "HTTP 404: empty body / Application not found",
      })
    ).toBe("HTTP 404: empty body / Application not found");
    expect(
      exportRouteFailureDetails({
        error: "LaTeX compilation failed",
        log: "latexContent is required",
      })
    ).toBe("latexContent is required");
    expect(
      exportRouteFailureDetails({
        details: "from details",
        log: "from log",
      })
    ).toBe("from details");
  });
});
