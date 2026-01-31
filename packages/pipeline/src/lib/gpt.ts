import OpenAI from "openai";
import "colors";

const openai = new OpenAI();

export async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: [text],
  });
  console.log(`GPT: Created embedding for "${text}"`.blue);
  return response.data[0].embedding;
}
