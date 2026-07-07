/**
 * Test harness for lib/puppeteer collectQaData.
 *
 * Usage (Node 24+ strip-types — no tsx needed, avoids esbuild __name injection
 * that breaks page.evaluate function serialization):
 *   node --experimental-strip-types scripts/test-puppeteer.ts <site-url> [output-directory]
 *   node --experimental-strip-types scripts/test-puppeteer.ts https://example.com
 *
 * If no URL is passed, defaults to a small, stable page so you can sanity-check
 * the pipeline quickly.
 */
// @ts-expect-error - .ts extension required by Node --experimental-strip-types
import { collectQaData } from "../lib/puppeteer/index.ts";

async function main() {
  const url = process.argv[2] || "https://example.com";
  const outputDir = process.argv[3];

  console.log("Running collectQaData against:", url);
  const start = Date.now();

  try {
    const result = await collectQaData(url, outputDir);
    console.log("\n=== Result ===");
    console.log("outputDir:", result.outputDir);
    console.log("siteWide JSON:", result.siteWide);
    console.log("breakpoints:", result.breakpoints.length);
    for (const bp of result.breakpoints) {
      console.log(`  - ${bp.dims}: ${bp.json}  |  ${bp.screenshot}`);
    }
    console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error("collectQaData failed:", err);
    process.exit(1);
  }
}

main();