"use server";

import { fetchData } from "./fetch";

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
  type?: "png" | "jpeg" | "webp";
  quality?: number;
  scrollPage?: boolean;
  waitForTimeout?: number;
}

export async function takeScreenshot(
  url: string,
  options: ScreenshotOptions = {}
): Promise<Uint8Array> {
  const {
    width = 1920,
    height = 1080,
    fullPage = true,
    type = "png",
    quality,
    scrollPage = true,
    waitForTimeout = 2000,
  } = options;

  const data: Record<string, unknown> = {
    url,
    viewport: { width, height },
    options: { type, fullPage },
    scrollPage,
    waitForTimeout,
  };

  if (quality !== undefined) {
    (data.options as Record<string, unknown>).quality = quality;
  }

  const result = await fetchData(data, "screenshot");
  return result as Uint8Array;
}
