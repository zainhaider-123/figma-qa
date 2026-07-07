import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const result = streamText({
  model: openrouter.chat(''),
  prompt: '',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}