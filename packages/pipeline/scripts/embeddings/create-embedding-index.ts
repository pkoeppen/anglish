import process from "node:process";
import {
  redis,
  REDIS_SYNSET_DATA_PREFIX,
  REDIS_SYNSET_DATA_VSS_INDEX,
  REDIS_SYNSET_SEARCH_PREFIX,
  REDIS_SYNSET_SEARCH_VSS_INDEX,
} from "@anglish/db";
import { SCHEMA_FIELD_TYPE } from "redis";

async function createSynsetSearchIndex() {
  const key = REDIS_SYNSET_SEARCH_VSS_INDEX;

  await dropIndex(key);

  console.log(`Creating index ${key}...`);
  await redis.ft.create(key, {
    synset_id: { type: SCHEMA_FIELD_TYPE.TEXT, AS: "synset_id" },
    embedding: {
      type: SCHEMA_FIELD_TYPE.VECTOR,
      AS: "embedding",
      ALGORITHM: "HNSW",
      TYPE: "FLOAT32",
      DIM: 3072,
      DISTANCE_METRIC: "COSINE",
      INITIAL_CAP: 110_000,
      M: 16,
      EF_CONSTRUCTION: 200,
    },
  }, {
    ON: "HASH",
    PREFIX: REDIS_SYNSET_SEARCH_PREFIX,
  });

  console.log(`Done.`);
}

async function createSynsetDataIndex() {
  const key = REDIS_SYNSET_DATA_VSS_INDEX;

  await dropIndex(key);

  console.log(`Creating index ${key}...`);
  await redis.ft.create(key, {
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
    PREFIX: REDIS_SYNSET_DATA_PREFIX,
  });

  console.log(`Done.`);
}

async function dropIndex(key: string) {
  console.log(`Dropping index ${key}...`);
  await redis.ft.dropIndex(key, { DD: true }).then(() => {}, () => {});
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);

  if (flags.has("--data")) {
    await createSynsetDataIndex();
  }
  if (flags.has("--search")) {
    await createSynsetSearchIndex();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
