export type ProgressCallback = (message: string) => void;

let currentWriter: ProgressCallback | null = null;

export function setProgressWriter(writer: ProgressCallback | null): void {
  currentWriter = writer;
}

export function emitProgress(message: string): void {
  console.log(message);
  currentWriter?.(message);
}
