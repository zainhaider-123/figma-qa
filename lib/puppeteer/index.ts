export type {
  Breakpoint,
  BreakpointCategory,
  QaBreakpointResult,
  QaCollectionResult,
} from "./automation";
export { collectQaData, dimsLabel, slugFromUrl, timestamp } from "./automation";
export type { SaveQaResultOutput } from "./save-to-db";
export { saveQaResultToDb } from "./save-to-db";

import type { QaCollectionResult } from "./automation";
import { collectQaData } from "./automation";
import type { SaveQaResultOutput } from "./save-to-db";
import { saveQaResultToDb } from "./save-to-db";

export async function collectAndSave(url: string): Promise<{
  result: QaCollectionResult;
  saved: SaveQaResultOutput;
}> {
  const result = await collectQaData(url);
  const saved = await saveQaResultToDb(result);
  return { result, saved };
}
