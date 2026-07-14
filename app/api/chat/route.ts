import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { qaPrompt } from "@/lib/ai/prompts";
import { qaModel } from "@/lib/ai/provider";
import { generatePdfTool } from "@/lib/ai/tools/generate-pdf";
import { getFrameTool } from "@/lib/ai/tools/get-frame";
import { getLiveSite } from "@/lib/ai/tools/get-live-site";
import { auth } from "@/lib/auth";
import { setProgressWriter } from "@/lib/progress";

function createProgressStream(): {
  stream: ReadableStream<{ type: string; id: string; delta: string }>;
  write: (msg: string) => void;
  close: () => void;
} {
  let id = 0;
  let controller: ReadableStreamDefaultController<{
    type: string;
    id: string;
    delta: string;
  }>;

  const stream = new ReadableStream<{
    type: string;
    id: string;
    delta: string;
  }>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    write(msg: string) {
      const pid = `progress-${id++}`;
      controller.enqueue({ type: "text-start", id: pid, delta: "" });
      controller.enqueue({ type: "text-delta", id: pid, delta: `${msg}\n` });
      controller.enqueue({ type: "text-end", id: pid, delta: "" });
    },
    close() {
      controller.close();
    },
  };
}

function mergeTextStreams<T>(
  a: ReadableStream<T>,
  b: ReadableStream<T>,
): ReadableStream<T> {
  return new ReadableStream<T>({
    async start(controller) {
      const [readerA, readerB] = [a.getReader(), b.getReader()];
      let active = 2;

      async function pump(reader: ReadableStreamDefaultReader<T>) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch {
          // reader closed
        } finally {
          active--;
          if (active === 0) controller.close();
        }
      }

      pump(readerA);
      pump(readerB);
    },
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = await request.json();
  const progress = createProgressStream();
  setProgressWriter(progress.write);

  const result = streamText({
    model: qaModel,
    system: qaPrompt,
    tools: {
      "get-frame": getFrameTool,
      "get-live-site": getLiveSite,
      "generate-pdf": generatePdfTool,
    },
    // biome-ignore lint/suspicious/noExplicitAny: Request body is runtime-validated by the AI SDK
    messages: await convertToModelMessages(messages as any),
    stopWhen: isStepCount(10),
    onFinish: () => {
      progress.close();
      setProgressWriter(null);
    },
  });

  // biome-ignore lint/suspicious/noExplicitAny: progress stream emits valid TextStreamPart shapes
  const merged = mergeTextStreams(result.stream, progress.stream as any);

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: merged as any }),
  });
}
