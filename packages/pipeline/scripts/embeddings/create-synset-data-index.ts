import process from "node:process";
import {
  redis,
  REDIS_SYNSET_DATA_PREFIX_FULL,
  REDIS_SYNSET_DATA_PREFIX_WORDNET,
  REDIS_SYNSET_VSS_INDEX_FULL,
  REDIS_SYNSET_VSS_INDEX_WORDNET,
} from "@anglish/db";
import { SCHEMA_FIELD_TYPE } from "redis";

async function createSynsetIndexWordnet() {
  const key = REDIS_SYNSET_VSS_INDEX_WORDNET;

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
    PREFIX: REDIS_SYNSET_DATA_PREFIX_WORDNET,
  });

  process.stdout.write(" Done\n");
}

async function createSynsetIndexFull() {
  const key = REDIS_SYNSET_VSS_INDEX_FULL;

  await dropIndex(key);

  process.stdout.write(`Creating index ${key}...`);
  await redis.ft.create(key, {
    "$.pos": { type: SCHEMA_FIELD_TYPE.TAG, AS: "pos" },
    "$.lang": { type: SCHEMA_FIELD_TYPE.TAG, AS: "lang" },
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
    PREFIX: REDIS_SYNSET_DATA_PREFIX_FULL,
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
  if (flags.has("--wordnet")) {
    await createSynsetIndexWordnet();
  }
  if (flags.has("--full")) {
    await createSynsetIndexFull();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
