import type { SynsetDataRedisJSON } from "@anglish/db";
import type { RedisJSON } from "redis";
import type { SynsetEmbeddingJSONL } from "../../src/types";
import { Buffer } from "node:buffer";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { redis, REDIS_SYNSET_DATA_PREFIX, REDIS_SYNSET_SEARCH_PREFIX } from "@anglish/db";
import { dataRoot } from "../../src/constants";

function f32ToBuf(v: Float32Array) {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

/**
 * This function populates the Redis index used by the API app to search the top
 * synset matches for the given query string. Refer to @anglish/db/src/queries/search.ts.
 */
async function loadSynsetSearchHashes() {
  const embeddingsFile = path.join(dataRoot, "anglish", "synset_embeddings.jsonl");

  console.log(`Loading synset embeddings from ${embeddingsFile}`);

  const embeddingsStream = await open(embeddingsFile);

  console.log(`Inserting synset embeddings into Redis (${REDIS_SYNSET_SEARCH_PREFIX}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: SynsetEmbeddingJSONL[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (embedding) => {
      const key = `${REDIS_SYNSET_SEARCH_PREFIX}${embedding.synsetId}`;
      const f32 = new Float32Array(embedding.embedding);
      const buf = f32ToBuf(f32);
      return redis.hSet(key, { synset_id: embedding.synsetId, embedding: buf });
    }));
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} synset embeddings`.gray);
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

  process.stdout.write("\n");
}

/**
 * This function populates the Redis index used by the pipeline to query the top
 * synset matches for a given gloss. Refer to stages/06_map.ts for the implementation.
 */
async function loadSynsetDataJSON() {
  const embeddingsFile = path.join(dataRoot, "anglish", "synset_embeddings.jsonl");

  console.log(`Loading synset embeddings from ${embeddingsFile}`);

  const embeddingsStream = await open(embeddingsFile);

  console.log(`Inserting synset embeddings into Redis (${REDIS_SYNSET_DATA_PREFIX}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: SynsetEmbeddingJSONL[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (embedding) => {
      const key = `${REDIS_SYNSET_DATA_PREFIX}${embedding.synsetId}`;
      const json: SynsetDataRedisJSON = {
        synset_id: embedding.synsetId,
        pos: embedding.pos,
        category: embedding.category,
        headword: embedding.headword,
        embedding: embedding.embedding,
      };
      return redis.json.set(key, "$", json as unknown as RedisJSON);
    }));
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} synset embeddings`.gray);
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

  process.stdout.write("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);

  if (flags.has("--data")) {
    await loadSynsetDataJSON();
  }
  if (flags.has("--search")) {
    await loadSynsetSearchHashes();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
