import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { figmaQaRuns } from "@/lib/db/schema";
import type { FigmaFrameData } from "./get-frame";

export interface SaveFigmaResultOutput {
  runId: number;
  run: typeof figmaQaRuns.$inferSelect;
}

export async function saveFigmaToDb(
  data: FigmaFrameData,
): Promise<SaveFigmaResultOutput> {
  const [run] = await db
    .insert(figmaQaRuns)
    .values({
      figmaUrl: `https://www.figma.com/design/${data.fileKey}${data.nodeId ? `?node-id=${data.nodeId}` : ""}`,
      fileKey: data.fileKey,
      nodeId: data.nodeId,
      title: data.title,
      headings: data.headings,
      images: data.images,
      links: data.links,
      headingInversion: data.headingInversion,
      brokenImages: data.brokenImages,
      linkTransition: data.linkTransition,
      overflows: data.overflows,
      sections: data.sections,
    })
    .returning({ id: figmaQaRuns.id });

  const [savedRun] = await db
    .select()
    .from(figmaQaRuns)
    .where(eq(figmaQaRuns.id, run.id));

  return { runId: run.id, run: savedRun };
}
