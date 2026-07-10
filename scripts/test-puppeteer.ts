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
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  collectQaData,
  slugFromUrl,
  timestamp,
} from "../lib/puppeteer/automation.ts";

async function main() {
  const url = process.argv[2] || "https://example.com";
  const outputDir =
    process.argv[3] ||
    join(
      process.cwd(),
      "figma-design-qa-reports",
      `${timestamp()}_${slugFromUrl(url)}`,
    );

  console.log("Running collectQaData against:", url);
  const start = Date.now();

  try {
    const result = await collectQaData(url);

    const screenshotsDir = join(outputDir, "screenshots");
    const dataDir = join(outputDir, "data");
    await mkdir(screenshotsDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });

    const siteWidePath = join(dataDir, "site-wide.json");
    await writeFile(
      siteWidePath,
      JSON.stringify(result.siteWide, null, 2),
      "utf8",
    );

    console.log("\n=== Result ===");
    console.log("outputDir:", outputDir);
    console.log("siteWide JSON:", siteWidePath);
    console.log("breakpoints:", result.breakpoints.length);

    for (const bp of result.breakpoints) {
      const bpJsonPath = join(dataDir, `bp-${bp.dims}.json`);
      await writeFile(bpJsonPath, JSON.stringify(bp.data, null, 2), "utf8");

      const shotPath = join(screenshotsDir, `${bp.dims}.png`);
      await writeFile(shotPath, bp.screenshot);

      console.log(`  - ${bp.dims}: ${bpJsonPath}  |  ${shotPath}`);
    }

    console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error("collectQaData failed:", err);
    process.exit(1);
  }
}

main();
