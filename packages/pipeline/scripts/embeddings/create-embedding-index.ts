import process from "node:process";
import { redis } from "@anglish/db";
import { SCHEMA_FIELD_TYPE } from "redis";
import {
  REDIS_FLAT_PREFIX,
  REDIS_HNSW_PREFIX,
  REDIS_VSS_FLAT_INDEX,
  REDIS_VSS_HNSW_INDEX,
} from "../../src/constants";

async function createSynsetEmbeddingIndex() {
  const key = REDIS_VSS_HNSW_INDEX;

  console.log(`Dropping index ${key}...`);
  await redis.ft.dropIndex(key, { DD: true }).then(() => {}, () => {});

  console.log(`Creating index ${key}...`);
  await redis.ft.create(key, {
    pos: { type: SCHEMA_FIELD_TYPE.TAG, AS: "pos" },
    vector: {
      type: SCHEMA_FIELD_TYPE.VECTOR,
      AS: "vector",
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
    PREFIX: REDIS_HNSW_PREFIX,
  });

  console.log(`Done.`);
}

async function createSynsetEmbeddingIndexJSON() {
  const key = REDIS_VSS_FLAT_INDEX;

  console.log(`Dropping index ${key}...`);
  await redis.ft.dropIndex(key, { DD: true }).then(() => {}, () => {});

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
    PREFIX: REDIS_FLAT_PREFIX,
  });

  console.log(`Done.`);
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  const json = flags.has("--json");

  if (json) {
    await createSynsetEmbeddingIndexJSON();
  }
  else {
    await createSynsetEmbeddingIndex();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
