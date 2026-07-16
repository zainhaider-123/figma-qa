import { tool } from "ai";
import { z } from "zod";

interface Finding {
  section: string;
  parameter: string;
  expected: string;
  found: string;
  verdict: "pass" | "warning" | "severe";
  note: string;
  selector: string;
}

export const generatePdfTool = tool({
  description:
    "Compiles QA findings into a structured PDF report. " +
    "Accepts an array of findings, the Figma URL, and the live site URL. " +
    "Returns a report object with summary counts and a download URL.",
  inputSchema: z.object({
    findings: z
      .array(
        z.object({
          section: z.string(),
          parameter: z.string(),
          expected: z.string(),
          found: z.string(),
          verdict: z.enum(["pass", "warning", "severe"]),
          note: z.string(),
          selector: z.string(),
        }),
      )
      .describe("Array of QA findings from the section-by-section comparison."),
    figmaUrl: z.string().describe("The Figma design URL that was audited."),
    liveSiteUrl: z.string().describe("The live site URL that was audited."),
  }),
  execute: async ({ findings, figmaUrl, liveSiteUrl }) => {
    const passCount = findings.filter((f) => f.verdict === "pass").length;
    const warningCount = findings.filter((f) => f.verdict === "warning").length;
    const severeCount = findings.filter((f) => f.verdict === "severe").length;

    const report = {
      generatedAt: new Date().toISOString(),
      figmaUrl,
      liveSiteUrl,
      summary: {
        total: findings.length,
        pass: passCount,
        warning: warningCount,
        severe: severeCount,
      },
      findings,
      // PDF generation is not yet fully implemented.
      // This returns the structured report data that would be used to generate a PDF.
      downloadUrl: null,
      status: "report_generated",
    };

    return report;
  },
});
