import process from "node:process";
import {
  redis,
  REDIS_SYNSET_DATA_PREFIX,
  REDIS_SYNSET_FLAT_VSS_INDEX,
  REDIS_SYNSET_HNSW_VSS_INDEX,
} from "@anglish/db";
import { SCHEMA_FIELD_TYPE } from "redis";

async function createSynsetSearchIndex() {
  const key = REDIS_SYNSET_HNSW_VSS_INDEX;

  await dropIndex(key);

  process.stdout.write(`Creating index ${key}...`);
  await redis.ft.create(key, {
    "$.pos": { type: SCHEMA_FIELD_TYPE.TAG, AS: "pos" },
    "$.embedding": {
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
    ON: "JSON",
    PREFIX: REDIS_SYNSET_DATA_PREFIX,
  });

  process.stdout.write(" Done\n");
}

async function createSynsetDataIndex() {
  const key = REDIS_SYNSET_FLAT_VSS_INDEX;

  await dropIndex(key);

  process.stdout.write(`Creating index ${key}...`);
  await redis.ft.create(key, {
    "$.pos": { type: SCHEMA_FIELD_TYPE.TAG, AS: "pos" },
    "$.vector": {
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

  process.stdout.write(" Done\n");
}

async function flushAll() {
  process.stdout.write("Flushing Redis...");
  await redis.flushAll();
  process.stdout.write(" Done\n");
}

async function dropIndex(key: string) {
  process.stdout.write(`Dropping index ${key}...`);
  await redis.ft.dropIndex(key, { DD: true }).then(() => {}, () => {});
  process.stdout.write(" Done\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);

  if (flags.has("--flush")) {
    await flushAll();
  }
  await createSynsetDataIndex();
  await createSynsetSearchIndex();
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
