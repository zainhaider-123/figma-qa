import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

/** Pre-configured OpenRouter model for the QA agent. */
export const qaModel = openrouter.chat("xiaomi/mimo-v2.5");
