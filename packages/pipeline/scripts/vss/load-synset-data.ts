import type { RedisSynsetData } from "@anglish/db";
import type { RedisJSON } from "redis";
import { Buffer } from "node:buffer";
import { readSync } from "node:fs";
import { open } from "node:fs/promises";
import process from "node:process";
import { redis, REDIS_SYNSET_DATA_PREFIX } from "@anglish/db";
import { SYNSET_DATA_JSONL_PATH, SYNSET_EMBEDDING_BIN_PATH } from "./constants";

const EMBEDDING_DIM = 3072;
const EMBEDDING_BYTES = EMBEDDING_DIM * 4;

async function loadSynsetData() {
  const dataFile = await open(SYNSET_DATA_JSONL_PATH);
  const embeddingFile = await open(SYNSET_EMBEDDING_BIN_PATH);
  const prefix = REDIS_SYNSET_DATA_PREFIX;

  console.log(`Inserting synset data into Redis (${prefix}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: RedisSynsetData[] = [];

  const processBatch = async () => {
    const pipeline = redis.multi();
    for (const data of batch) {
      const key = `${prefix}${data.synset_id}`;
      pipeline.json.set(key, "$", data as unknown as RedisJSON);
    }
    await pipeline.exec();
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} synset data entries`.gray);
    batch.length = 0;
  };

  let index = 0;
  for await (const line of dataFile.readLines()) {
    const data = JSON.parse(line);
    const offset = index * EMBEDDING_BYTES;
    const embedding = readEmbedding(embeddingFile.fd, offset);

    batch.push({ embedding, ...data });
    if (batch.length >= BATCH_SIZE) {
      await processBatch();
    }
    index++;
  }

  if (batch.length > 0) {
    await processBatch();
  }

  process.stdout.write("\n");
}

// The embedding must be of type number[] and not Float32Array
// before being passed to the node-redis client. Otherwise, it will
// serialize it as an object, like { "0": 0.123, "1": -0.987, ... }
function readEmbedding(fd: number, offset: number): number[] {
  const buf = Buffer.allocUnsafe(EMBEDDING_BYTES);
  readSync(fd, buf, 0, buf.length, offset);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, EMBEDDING_DIM);
  return Array.from(f32);
}

async function main() {
  await loadSynsetData();
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
