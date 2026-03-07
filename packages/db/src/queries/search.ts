import { Buffer } from "node:buffer";
import { REDIS_SYNSET_HNSW_VSS_INDEX } from "../constants";
import { createEmbedding } from "../lib";
import { redis } from "../redis";

interface VectorSearchResult {
  id: string;
  pos: string;
  category: string;
  headword: string;
  gloss?: string;
  score: number;
}

export async function vectorSearchHNSW(text: string, pos?: string, k = 20) {
  const embedding = await createEmbedding(text);
  const filter = pos ? `@pos:{${pos}} ` : "*";
  const query = `${filter}=>[KNN ${k} @embedding $query_vector AS score]`;
  const float32 = new Float32Array(embedding);
  const bytes = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

  console.log("query:", query);

  const vssResult = await redis.ft.search(REDIS_SYNSET_HNSW_VSS_INDEX, query, {
    SORTBY: "score",
    RETURN: ["score", "pos"],
    DIALECT: 2,
    PARAMS: {
      query_vector: bytes,
    },
    LIMIT: {
      from: 0,
      size: k,
    },
  });

  const pipeline = redis.multi();
  for (const { id: key } of vssResult.documents) {
    pipeline.json.get(key, { path: "$" });
  }

  const data = await pipeline.exec();
  return data as unknown as VectorSearchResult[][];
}
