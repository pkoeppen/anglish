import process from "node:process";
import {
  redis,
  REDIS_LEMMA_DATA_PREFIX,
  REDIS_LEMMA_VSS_INDEX,
  REDIS_SYNSET_DATA_PREFIX,
  REDIS_SYNSET_VSS_INDEX,
} from "@anglish/db";
import { SCHEMA_FIELD_TYPE } from "redis";

async function createSynsetDataIndex() {
  const key = REDIS_SYNSET_VSS_INDEX;

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

async function createLemmaDataIndex() {
  const key = REDIS_LEMMA_VSS_INDEX;

  await dropIndex(key);

  process.stdout.write(`Creating index ${key}...`);
  await redis.ft.create(key, {
    "$.lemma": { type: SCHEMA_FIELD_TYPE.TAG, AS: "lemma" },
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
    PREFIX: REDIS_LEMMA_DATA_PREFIX,
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
  if (flags.has("--synset")) {
    await createSynsetDataIndex();
  }
  if (flags.has("--lemma")) {
    await createLemmaDataIndex();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
