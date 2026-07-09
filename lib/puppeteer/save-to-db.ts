import { put, getDownloadUrl } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { qaBreakpoints, qaRuns } from "@/lib/db/schema";
import type { QaCollectionResult } from "./automation";
import { slugFromUrl, timestamp } from "./automation";

export interface SaveQaResultOutput {
  runId: number;
  run: typeof qaRuns.$inferSelect;
  breakpoints: (typeof qaBreakpoints.$inferSelect)[];
}

export async function saveQaResultToDb(
  result: QaCollectionResult,
): Promise<SaveQaResultOutput> {
  const site = result.siteWide as Record<string, unknown>;

  const [run] = await db
    .insert(qaRuns)
    .values({
      url: site.url as string,
      siteTitle: site.title as string,
      siteFavicon: (site.favicon as string) ?? null,
      siteHeadings: site.headings,
      siteImages: site.images,
      siteLinks: site.links,
      siteHeadingInversion: site.headingInversion,
      siteBrokenImages: site.brokenImages,
      siteLinkTransition: (site.linkTransition as string) ?? null,
      siteOverflows: site.overflows,
      siteSections: site.sections,
    })
    .returning({ id: qaRuns.id });

  const slug = slugFromUrl(site.url as string);
  const ts = timestamp();

  for (const bp of result.breakpoints) {
    const bpData = bp.data as Record<string, unknown>;
    const viewport = bpData.viewport as Record<string, unknown>;

    const blobPath = `${slug}/${ts}/${bp.dims}.png`;
    const blob = await put(blobPath, bp.screenshot, {
      access: "private",
      contentType: "image/png",
    });

    const screenshotUrl = await getDownloadUrl(blob.url);

    await db.insert(qaBreakpoints).values({
      runId: run.id,
      dims: bp.dims,
      category: bp.category,
      width: viewport.width as number,
      height: viewport.height as number,
      overflows: bpData.overflows,
      hiddenSections: bpData.hiddenSections,
      hamburgerDetected: (bpData.hamburgerDetected as boolean) ?? false,
      hamburgerLinks: bpData.hamburgerLinks,
      sectionBounds: bpData.sectionBounds,
      screenshotBlobUrl: screenshotUrl,
    });
  }

  const [savedRun] = await db.select().from(qaRuns).where(eq(qaRuns.id, run.id));
  const savedBreakpoints = await db
    .select()
    .from(qaBreakpoints)
    .where(eq(qaBreakpoints.runId, run.id));

  return { runId: run.id, run: savedRun, breakpoints: savedBreakpoints };
}
