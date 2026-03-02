import type { RedisSynsetData } from "@anglish/db";
import type { RedisJSON } from "redis";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { redis, REDIS_SYNSET_DATA_PREFIX } from "@anglish/db";
import { dataRoot } from "../../src/constants";

async function loadSynsetData() {
  const synsetDataFile = path.join(dataRoot, "anglish", "redis_synset_data.jsonl");

  console.log(`Loading Redis synset data from ${synsetDataFile}`);

  const synsetDataStream = await open(synsetDataFile);

  console.log(`Inserting synset data into Redis (${REDIS_SYNSET_DATA_PREFIX}*)...`);

  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  const batch: RedisSynsetData[] = [];

  const processBatch = async () => {
    await Promise.all(batch.map(async (synsetData) => {
      const key = `${REDIS_SYNSET_DATA_PREFIX}${synsetData.synset_id}`;
      return redis.json.set(key, "$", synsetData as unknown as RedisJSON);
    }));
    totalProcessed += batch.length;
    process.stdout.write(`\r └─ Processed ${totalProcessed} synset data entries`.gray);
    batch.length = 0;
  };

  for await (const line of synsetDataStream.readLines()) {
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
  await loadSynsetData();
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
