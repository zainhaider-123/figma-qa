import { OpenRouter } from "@openrouter/sdk";

const client = new OpenRouter({
  // apiKey: process.env.OPENROUTER_API_KEY ?? "",
  apiKey: "",
});

async function testBasicChat() {
  console.log("\n--- testBasicChat ---");
  const res = await client.chat.send({
    chatRequest: {
      model: "tencent/hy3:free",
      messages: [{ role: "user", content: "are you a robot?" }],
    },
  });
  console.log(res.choices[0].message.content);
}

testBasicChat()