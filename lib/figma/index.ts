export type {
  FigmaFrameData,
  FigmaHeading,
  FigmaImage,
  FigmaLink,
  FigmaOverflow,
  FigmaSection,
} from "./get-frame";
export { getFrame } from "./get-frame";
export type { SaveFigmaResultOutput } from "./save-to-db";
export { saveFigmaToDb } from "./save-to-db";

import type { FigmaFrameData } from "./get-frame";
import { getFrame } from "./get-frame";
import type { SaveFigmaResultOutput } from "./save-to-db";
import { saveFigmaToDb } from "./save-to-db";

export async function getAndSaveFrame(url: string): Promise<{
  data: FigmaFrameData;
  saved: SaveFigmaResultOutput;
}> {
  const data = await getFrame(url);
  const saved = await saveFigmaToDb(data);
  return { data, saved };
}

/** Helpers to proxy private Vercel Blob images through the authenticated /api/analyze-image endpoint */

export function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function toImageProxyUrl(blobUrl: string): string {
  if (!isVercelBlobUrl(blobUrl)) return blobUrl;
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const proxy = new URL("/api/analyze-image", base);
  proxy.searchParams.set("imageUrl", blobUrl);
  return proxy.toString();
}

export function proxyBreakpointImages<
  T extends { screenshotBlobUrl?: string | null },
>(breakpoints: T[]): T[] {
  return breakpoints.map((bp) => ({
    ...bp,
    screenshotBlobUrl: bp.screenshotBlobUrl
      ? toImageProxyUrl(bp.screenshotBlobUrl)
      : bp.screenshotBlobUrl,
  }));
}
