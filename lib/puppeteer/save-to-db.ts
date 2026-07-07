import { put } from "@vercel/blob";
import { db } from "../db/drizzle";
import { qaSessions, qaBreakpoints, qaImages } from "../db/schema";
import {
  slugFromUrl,
  timestamp,
  type QaCollectionResult,
  type QaBreakpointResult,
} from "./automation";

interface SiteWideImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  alt: string;
  visible: boolean;
  selector: string;
  xpath: string;
}

async function uploadScreenshot(
  slug: string,
  dims: string,
  screenshot: Buffer,
): Promise<string> {
  const ts = timestamp();
  const { url } = await put(`qa/${slug}/${dims}_${ts}.png`, screenshot, {
    access: "private",
    contentType: "image/png",
  });
  return url;
}

function isBroken(img: SiteWideImage): boolean {
  return (
    img.naturalWidth === 0 &&
    img.naturalHeight === 0 &&
    !!img.src &&
    !img.src.endsWith(".svg")
  );
}

export async function saveQaRun(
  url: string,
  result: QaCollectionResult,
): Promise<number> {
  const slug = slugFromUrl(url);

  const [session] = await db
    .insert(qaSessions)
    .values({
      url,
      siteSlug: slug,
      status: "completed",
      siteWideData: result.siteWide,
    })
    .returning({ id: qaSessions.id });

  for (const bp of result.breakpoints) {
    const [w, h] = bp.dims.split("x").map(Number);

    const blobUrl = await uploadScreenshot(slug, bp.dims, bp.screenshot);

    const [breakpoint] = await db
      .insert(qaBreakpoints)
      .values({
        sessionId: session.id,
        dims: bp.dims,
        category: bp.category,
        width: w,
        height: h,
        screenshotBlobUrl: blobUrl,
        data: bp.data,
      })
      .returning({ id: qaBreakpoints.id });

    const bpData = bp.data as Record<string, unknown> | undefined;
    const bpImages = bpData?.images as SiteWideImage[] | undefined;
    if (bpImages && Array.isArray(bpImages)) {
      for (const img of bpImages) {
        await db.insert(qaImages).values({
          sessionId: session.id,
          breakpointId: breakpoint.id,
          src: img.src || "",
          alt: img.alt || "",
          naturalWidth: img.naturalWidth || 0,
          naturalHeight: img.naturalHeight || 0,
          visible: img.visible ?? false,
          broken: isBroken(img),
          selector: img.selector || "",
          xpath: img.xpath || "",
        });
      }
    }
  }

  const siteWide = result.siteWide as Record<string, unknown>;
  const siteImages = siteWide?.images as SiteWideImage[] | undefined;
  if (siteImages && Array.isArray(siteImages)) {
    for (const img of siteImages) {
      await db.insert(qaImages).values({
        sessionId: session.id,
        breakpointId: null,
        src: img.src || "",
        alt: img.alt || "",
        naturalWidth: img.naturalWidth || 0,
        naturalHeight: img.naturalHeight || 0,
        visible: img.visible ?? false,
        broken: isBroken(img),
        selector: img.selector || "",
        xpath: img.xpath || "",
      });
    }
  }

  return session.id;
}
