import { logger } from "@anglish/core/server";
import OpenAI from "openai";
import "colors";

const openai = new OpenAI();

export async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: [text],
  });

  logger.debug(`GPT: Created embedding for "${text}"`.blue);

  return Float32Array.from(response.data[0].embedding);
}

export function combineEmbeddings(items: { embedding: Float32Array; weight: number }[]) {
  const length = items[0].embedding.length;
  const out = new Float32Array(length);
  for (const { embedding, weight } of items) {
    for (let i = 0; i < length; i++) {
      out[i] += embedding[i] * weight;
    }
  }
  return out;
}
