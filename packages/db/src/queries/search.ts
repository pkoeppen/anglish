import { Buffer } from "node:buffer";
import { db } from "../client";
import {
  REDIS_SYNSET_DATA_PREFIX,
  REDIS_SYNSET_SEARCH_PREFIX,
  REDIS_SYNSET_SEARCH_VSS_INDEX,
} from "../constants";
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

interface SynsetEmbeddingJSON {
  id: string;
  pos: string;
  category: string;
  headword: string;
  embedding: number[];
}

export async function vectorSearchHNSW(
  text: string,
  pos?: string,
  k = 20,
): Promise<VectorSearchResult[]> {
  const embedding = await createEmbedding(text);

  const filter = pos ? `@pos:{${pos}} ` : "";
  const query = `${filter}=>[KNN ${k} @vector $query_vector AS score]`;
  const float32 = new Float32Array(embedding);
  const bytes = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

  const results = await redis.ft.search(REDIS_SYNSET_SEARCH_VSS_INDEX, query, {
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

  console.log(results.documents);
  return [] as any;

  const synsets = await Promise.all(
    results.documents.map(async ({ id, value: { score } }) => {
      const synsetId = id.startsWith(REDIS_SYNSET_SEARCH_PREFIX)
        ? id.slice(REDIS_SYNSET_SEARCH_PREFIX.length)
        : id;
      const jsonKey = `${REDIS_SYNSET_DATA_PREFIX}${synsetId}`;
      const synsetJson = await redis.json.get(jsonKey) as SynsetEmbeddingJSON | null;

      if (synsetJson) {
        return {
          id: synsetJson.id,
          pos: synsetJson.pos,
          category: synsetJson.category,
          headword: synsetJson.headword,
          score: Number(score),
        };
      }

      const synset = await db.kysely
        .selectFrom("synset")
        .select(["id", "pos", "gloss", "category"])
        .where("id", "=", synsetId)
        .executeTakeFirst();

      if (synset) {
        return {
          id: synset.id,
          pos: synset.pos,
          category: synset.category ?? "",
          headword: synset.gloss?.split(";")[0] ?? synset.id,
          gloss: synset.gloss,
          score: Number(score),
        };
      }

      return {
        id: synsetId,
        pos: "",
        category: "",
        headword: synsetId,
        score: Number(score),
      };
    }),
  );

  return synsets;
}
