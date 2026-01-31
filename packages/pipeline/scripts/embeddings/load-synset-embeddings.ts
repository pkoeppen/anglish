import type { RedisJSON } from "redis";
import type { SynsetEmbeddingJSON } from "../../src/types";
import { Buffer } from "node:buffer";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { redis } from "@anglish/db";
import { dataRoot, REDIS_FLAT_PREFIX, REDIS_HNSW_PREFIX } from "../../src/constants";

function f32ToBuf(v: Float32Array) {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

async function loadSynsetEmbeddings() {
  const embeddingsFile = path.join(dataRoot, "anglish", "synset_embeddings.jsonl");
  console.log(`Loading synset embeddings from ${embeddingsFile}`);

  const embeddingsStream = await open(embeddingsFile);

  console.log(`Inserting synset embeddings into Redis (${REDIS_HNSW_PREFIX}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: SynsetEmbeddingJSON[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (embedding) => {
      const key = `${REDIS_HNSW_PREFIX}${embedding.id}`;
      const f32 = new Float32Array(embedding.embedding);
      const buf = f32ToBuf(f32);
      return redis.hSet(key, { pos: embedding.pos, vector: buf });
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

async function loadSynsetEmbeddingsJSON() {
  const embeddingsFile = path.join(dataRoot, "anglish", "synset_embeddings.jsonl");
  console.log(`Loading synset embeddings from ${embeddingsFile}`);

  const embeddingsStream = await open(embeddingsFile);

  console.log(`Inserting synset embeddings into Redis (${REDIS_FLAT_PREFIX}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: SynsetEmbeddingJSON[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (embedding) => {
      const key = `${REDIS_FLAT_PREFIX}${embedding.id}`;
      return redis.json.set(key, "$", embedding as unknown as RedisJSON);
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
  const json = flags.has("--json");

  if (json) {
    await loadSynsetEmbeddingsJSON();
  }
  else {
    await loadSynsetEmbeddings();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
