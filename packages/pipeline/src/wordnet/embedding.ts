import type { WordnetPOS } from "@anglish/core";
import type { RedisJSON } from "redis";
import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import { open } from "node:fs/promises";
import * as path from "node:path";
import { redis } from "@anglish/db";
import OpenAI from "openai";
import { SCHEMA_FIELD_TYPE } from "redis";
import { dataRoot } from "../constants";
import { makeLimiter } from "../util";
import { loadWordnet } from "./wordnet";
import "colors";

const openai = new OpenAI();

export const REDIS_SYNSET_EMBEDDING_INDEX_KEY = "idx:synsets_vss";

export interface SynsetVec {
  id: string;
  headword: string;
  pos: WordnetPOS;
  embedding: number[];
}

export interface VectorSearchResult {
  headword: string;
  score: number;
}

export async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: [text],
  });
  console.log(`GPT: Created embedding for "${text}"`.blue);
  return response.data[0].embedding;
}

export async function createSynsetEmbeddings() {
  const outFile = path.join(dataRoot, "synset_embeddings.jsonl");
  const outStream = fs.createWriteStream(outFile);
  const { synsets } = loadWordnet();

  const concurrency = 30;
  const run = makeLimiter(concurrency, 4500 / 60);

  console.log(`Creating embeddings for ${Object.keys(synsets).length} synsets`);

  await Promise.all(
    Object.entries(synsets).map(([id, synset]) =>
      run(async () => {
        const definition = synset.definition.shift()!;
        const embedding = await createEmbedding(definition);
        const synsetVec: SynsetVec = {
          id,
          headword: synset.members.shift()!,
          pos: synset.partOfSpeech as WordnetPOS,
          embedding,
        };
        outStream.write(`${JSON.stringify(synsetVec)}\n`);
      }),
    ),
  );

  outStream.end();
}

/*
 * Loads synset definition text embeddings into Redis.
 */
export async function loadSynsetEmbeddings() {
  console.log(`Flushing Redis data`);
  await redis.flushAll();
  await createSynsetEmbeddingIndex();

  const embeddingsFile = path.join(dataRoot, "synset_embeddings.jsonl");
  const embeddingsStream = await open(embeddingsFile);

  console.log(`Loading synset embeddings from ${embeddingsFile}`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: SynsetVec[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (embedding) => {
      const key = `synset:${embedding.id}`;
      return redis.json.set(key, "$", embedding as unknown as RedisJSON);
    }));
    totalProcessed += batch.length;
    console.log(`Processed ${totalProcessed} synset embeddings`);
    batch.length = 0;
  };

  for await (const line of embeddingsStream.readLines()) {
    const embedding = JSON.parse(line);
    batch.push(embedding);
    if (batch.length >= BATCH_SIZE) {
      await processBatch();
    }
  }

  if (batch.length > 0) {
    await processBatch();
  }
}

export async function createSynsetEmbeddingIndex() {
  const indexKey = `idx:synsets_vss`;
  console.log(`Dropping index ${indexKey}`);
  await redis.ft.dropIndex(indexKey, { DD: true }).then(() => {}, () => {});
  console.log(`Creating index ${indexKey}`);
  await redis.ft.create(indexKey, {
    "$.pos": { type: SCHEMA_FIELD_TYPE.TAG, AS: "pos" },
    "$.embedding": {
      type: SCHEMA_FIELD_TYPE.VECTOR,
      AS: "vector",
      ALGORITHM: "FLAT",
      INITIAL_CAP: 110_000,
      TYPE: "FLOAT32",
      DIM: 3072,
      DISTANCE_METRIC: "COSINE",
    },
  }, {
    ON: "JSON",
    PREFIX: "synset:",
  });
  console.log(`Index ${indexKey} created`);
}

export async function vectorSearch(text: string, pos: WordnetPOS, k = 20): Promise<VectorSearchResult[]> {
  const embedding = await createEmbedding(text);

  const query = `@pos:{${pos}} =>[KNN ${k} @vector $query_vector AS score]`;
  const float32 = new Float32Array(embedding);
  const bytes = Buffer.from(float32.buffer);

  const results = await redis.ft.search(REDIS_SYNSET_EMBEDDING_INDEX_KEY, query, {
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

  const synsets = await Promise.all(results.documents.map(async ({ id, value: { score } }) => {
    const synset = await redis.json.get(id) as unknown as SynsetVec;
    return {
      headword: synset.headword,
      score: Number(score),
    };
  }));

  return synsets;
}
