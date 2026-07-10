import { tool } from "ai";
import { z } from "zod";
import { getAndSaveFrame } from "@/lib/figma";

export const getFrameTool = tool({
  description:
    "Fetches a Figma frame or file from a Figma URL, extracts all design data (headings, images, links, sections, overflows), saves it to the database, and returns the persisted run. " +
    "Requires the user to be authenticated and have a linked Figma account. " +
    "Accepts a full Figma URL (e.g. https://www.figma.com/file/abc123/Design?node-id=1-2) and returns the saved run with all extracted design properties.",
  inputSchema: z.object({
    url: z
      .string()
      .describe(
        "REQUIRED. The full Figma URL to the design file or frame. Must include the node-id query parameter to target a specific frame.",
      ),
  }),
  execute: async ({ url }) => {
    try {
      const { saved } = await getAndSaveFrame(url);
      return saved;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[get-frame tool error]", msg, e);
      return { error: msg };
    }
  },
});
