import Browserless from "@/lib/browser";
import { tool } from "ai";
import { z } from "zod";

const getLiveSite = tool({
  description:
    "Opens the live site via Browserless, collects all site-wide data, tests every responsive breakpoint, takes full-page screenshots, and detects hamburger nav + overflow issues. Saves everything into the per-run data directory.",
  inputSchema: z.object({
    url: z.string().describe("REQUIRED. The URL of the live site to be tested."),
  }),
  execute: async ({ url }) => {
    // Your implementation
    return Browserless(url);
  },
});