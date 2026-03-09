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
