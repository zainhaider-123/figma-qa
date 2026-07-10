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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as {
    messages: Array<Record<string, unknown>>;
  };
  const messages = body.messages ?? [];

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
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
