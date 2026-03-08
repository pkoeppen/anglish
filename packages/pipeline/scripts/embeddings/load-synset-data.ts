import type { RedisSynsetData } from "@anglish/db";
import type { RedisJSON } from "redis";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { redis, REDIS_SYNSET_DATA_PREFIX_FULL, REDIS_SYNSET_DATA_PREFIX_WORDNET } from "@anglish/db";
import { dataRoot } from "../../src/constants";

async function loadSynsetData(filename: string, prefix: string) {
  const synsetDataFile = path.join(dataRoot, "anglish", filename);
  const synsetDataStream = await open(synsetDataFile);

  console.log(`Loading synset data from ${synsetDataFile}`);
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
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  if (flags.has("--wordnet")) {
    await loadSynsetData("redis_synset_data_wordnet.jsonl", REDIS_SYNSET_DATA_PREFIX_WORDNET);
  }
  if (flags.has("--full")) {
    await loadSynsetData("redis_synset_data_full.jsonl", REDIS_SYNSET_DATA_PREFIX_FULL);
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
