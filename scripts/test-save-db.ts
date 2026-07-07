/**
 * Test harness: collects QA data for a site then saves results to DB + Vercel Blob.
 *
 * Usage:
 *   pnpm test:qa-db <site-url>
 *   pnpm test:qa-db https://example.com
 */
import "dotenv/config";
import { collectQaData, slugFromUrl, timestamp } from "../lib/puppeteer/automation";
import { saveQaRun } from "../lib/puppeteer/save-to-db";

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: pnpm test:qa-db <site-url>");
    process.exit(1);
  }

  console.log("Collecting QA data for:", url);
  const start = Date.now();

  try {
    const result = await collectQaData(url);

    console.log("\nSaving to DB...");
    const sessionId = await saveQaRun(url, result);

    console.log("\n=== Done ===");
    console.log("Session ID:", sessionId);
    console.log("Breakpoints:", result.breakpoints.length);
    console.log(`Finished in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
}

main();
