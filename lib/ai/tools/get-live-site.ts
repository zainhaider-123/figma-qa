import { tool } from "ai";
import { z } from "zod";
import { proxyBreakpointImages } from "@/lib/figma";
import { collectAndSave } from "@/lib/puppeteer";

export const getLiveSite = tool({
  description: `Opens the live site URL via Puppeteer at 1920x1080, scrolls to trigger lazy content, then collects all site-wide QA data and tests 18 responsive breakpoints (11 desktop, 3 iPad, 4 mobile). Saves everything to the database and returns the persisted run with full breakpoint results.\n\n
    + "Returns an object with:\n"
    + "- run: site-wide data (title, URL, favicon, all headings with font styles, all images with dimensions/visibility/alt text/broken detection, all links with hrefs/empty/placeholder flags, heading size hierarchy inversion check, horizontal overflow elements, page sections with bounds and labels)\n"
    + "- breakpoints: array of 18 per-viewport results, each containing:\n"
    + "  - dims, category (desktop/ipad/mobile), width, height\n"
    + "  - overflows: elements wider than viewport with selector/xpath/section label\n"
    + "  - hiddenSections: sections collapsed to zero height at this breakpoint\n"
    + "  - hamburgerDetected: whether a hamburger menu was found (mobile only)\n"
    + "  - hamburgerLinks: nav link text if hamburger menu was detected (mobile only)\n"
    + "  - screenshotBlobUrl: authenticated proxy URL for the full-page screenshot at this breakpoint (requires session cookie)\n"
    + "  - sectionBounds: array (reserved for future use)\n"
    + "- runId: database ID of the saved QA run`,
  inputSchema: z.object({
    url: z
      .string()
      .describe("REQUIRED. The URL of the live site to be tested."),
  }),
  execute: async ({ url }) => {
    const { saved } = await collectAndSave(url);
    return {
      ...saved,
      breakpoints: proxyBreakpointImages(saved.breakpoints),
    };
  },
});
