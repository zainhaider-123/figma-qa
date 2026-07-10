export { collectQaData, slugFromUrl, timestamp, dimsLabel } from "./automation";
export type {
  BreakpointCategory,
  Breakpoint,
  QaBreakpointResult,
  QaCollectionResult,
} from "./automation";
export { saveQaResultToDb } from "./save-to-db";
export type { SaveQaResultOutput } from "./save-to-db";

import { collectQaData } from "./automation";
import { saveQaResultToDb } from "./save-to-db";
import type { QaCollectionResult } from "./automation";
import type { SaveQaResultOutput } from "./save-to-db";

export async function collectAndSave(url: string): Promise<{
  result: QaCollectionResult;
  saved: SaveQaResultOutput;
}> {
  const result = await collectQaData(url);
  const saved = await saveQaResultToDb(result);
  return { result, saved };
}
