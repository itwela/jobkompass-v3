import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  exportRouteFailureDetails,
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

  it("falls back to the service error, then the HTTP status text", () => {
    expect(latexServiceFailureMessage({ error: "latexContent is required" }, "Bad Request")).toBe(
      "latexContent is required"
    );
    expect(latexServiceFailureMessage({}, "Bad Request")).toBe("Bad Request");
  });

  it("keeps a missing-service 404 message instead of the generic compile wrapper", () => {
    expect(
      latexServiceFailureMessage(
        { status: "error", code: 404, message: "Application not found" },
        "Not Found"
      )
    ).toBe("Application not found");
  });

  it("forwards export log into agent details when details is absent", () => {
    expect(exportRouteFailureDetails({ error: "LaTeX compilation failed" } as { log?: string })).toBeUndefined();
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
