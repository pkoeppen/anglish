import type { RedisLemmaData, RedisSynsetData } from "@anglish/db";
import type { RedisJSON } from "redis";
import { Buffer } from "node:buffer";
import { readSync } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { redis, REDIS_LEMMA_DATA_PREFIX, REDIS_SYNSET_DATA_PREFIX } from "@anglish/db";
import { dataRoot } from "../../src/constants";

const EMBEDDING_DIM = 3072;
const EMBEDDING_BYTES = EMBEDDING_DIM * 4;

async function loadSynsetData() {
  const dataFile = path.join(dataRoot, "anglish", "redis_synset_data.jsonl");
  const dataStream = await open(dataFile);
  const prefix = REDIS_SYNSET_DATA_PREFIX;

  console.log(`Loading synset data from ${dataFile}`);
  console.log(`Inserting synset data into Redis (${prefix}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: RedisSynsetData[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (synsetData) => {
      const key = `${prefix}${synsetData.synset_id}`;
      return redis.json.set(key, "$", synsetData as unknown as RedisJSON);
    }));
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} synset data entries`.gray);
    batch.length = 0;
  };

  for await (const line of dataStream.readLines()) {
    const data = JSON.parse(line);
    batch.push(data);
    if (batch.length >= BATCH_SIZE) {
      await processBatch();
    }
  }

  if (batch.length > 0) {
    await processBatch();
  }

  process.stdout.write("\n");
}

async function loadLemmaData() {
  const dataFilepath = path.join(dataRoot, "anglish", "redis_lemma_data.jsonl");
  const dataFile = await open(dataFilepath);
  const embeddingFilepath = path.join(dataRoot, "anglish", "redis_lemma_data.bin");
  const embeddingFile = await open(embeddingFilepath);
  const prefix = REDIS_LEMMA_DATA_PREFIX;

  console.log(`Loading lemma data from ${dataFilepath}`);
  console.log(`Inserting lemma data into Redis (${prefix}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: RedisLemmaData[] = [];

  const processBatch = async () => {
    const pipeline = redis.multi();
    for (const data of batch) {
      const key = `${prefix}${data.lemma_id}:${data.sense_id}:${data.synset_id}`;
      pipeline.json.set(key, "$", data as unknown as RedisJSON);
    }
    await pipeline.exec();
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} lemma data entries`.gray);
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

function readEmbedding(fd: number, offset: number): Float32Array {
  const buf = Buffer.allocUnsafe(EMBEDDING_BYTES);
  readSync(fd, buf, 0, buf.length, offset);
  return new Float32Array(buf.buffer, buf.byteOffset, EMBEDDING_DIM);
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  if (flags.has("--synset")) {
    await loadSynsetData();
  }
  if (flags.has("--lemma")) {
    await loadLemmaData();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
