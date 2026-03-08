import type { RedisLemmaData, RedisSynsetData } from "@anglish/db";
import type { RedisJSON } from "redis";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { redis, REDIS_LEMMA_DATA_PREFIX, REDIS_SYNSET_DATA_PREFIX } from "@anglish/db";
import { dataRoot } from "../../src/constants";

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
  const dataFile = path.join(dataRoot, "anglish", "redis_lemma_data.jsonl");
  const dataStream = await open(dataFile);
  const prefix = REDIS_LEMMA_DATA_PREFIX;

  console.log(`Loading lemma data from ${dataFile}`);
  console.log(`Inserting lemma data into Redis (${prefix}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: RedisLemmaData[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (lemmaData) => {
      const key = `${prefix}${lemmaData.lemma}:${lemmaData.pos}`;
      return redis.json.set(key, "$", lemmaData as unknown as RedisJSON);
    }));
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} lemma data entries`.gray);
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
