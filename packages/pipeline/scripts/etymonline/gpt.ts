import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "ollama",
  baseURL: "http://localhost:11434/v1",
});

const completion = await client.chat.completions.create({
  model: "llama3.1:70b",
  messages: [
    {
      role: "system",
      content:
        "Rewrite the paragraph for clarity and concision. Preserve meaning. Do not add facts.",
    },
    { role: "user", content: "Rewrite this paragraph: ..." },
  ],
  temperature: 0.3,
});

console.log(completion.choices[0]?.message?.content ?? "");
