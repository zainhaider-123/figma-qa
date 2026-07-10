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
