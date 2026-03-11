import process from "node:process";
import {
  redis,
  REDIS_SYNSET_DATA_PREFIX,
  REDIS_SYNSET_VSS_INDEX_FLAT,
  REDIS_SYNSET_VSS_INDEX_HNSW,
} from "@anglish/db";

async function createSynsetDataIndexFlat() {
  const key = REDIS_SYNSET_VSS_INDEX_FLAT;

  await dropIndex(key);

  process.stdout.write(`Creating index ${key}...`);

  /* eslint-disable antfu/consistent-list-newline */
  await redis.sendCommand([
    "FT.CREATE",
    key,
    "ON", "JSON",
    "PREFIX", "1", REDIS_SYNSET_DATA_PREFIX,
    "SCHEMA",
    "$.pos", "AS", "pos", "TAG",
    "$.embedding", "AS", "embedding",
    "VECTOR", "FLAT", "8",
    "TYPE", "FLOAT32",
    "DIM", "3072",
    "DISTANCE_METRIC", "COSINE",
    "INITIAL_CAP", "110000",
  ]);
  /* eslint-enable */

  process.stdout.write(" Done\n");
}

async function createSynsetDataIndexHNSW() {
  const key = REDIS_SYNSET_VSS_INDEX_HNSW;
  await dropIndex(key);

  process.stdout.write(`Creating index ${key}...`);

  /* eslint-disable antfu/consistent-list-newline */
  await redis.sendCommand([
    "FT.CREATE",
    key,
    "ON", "JSON",
    "PREFIX", "1", REDIS_SYNSET_DATA_PREFIX,
    "SCHEMA",
    "$.members[*].lemma", "AS", "lemma_text", "TEXT",
    "$.members[*].lemma", "AS", "lemma_tag", "TAG",
    "$.members[*].lang", "AS", "lemma_lang", "TAG",
    "$.pos", "AS", "pos", "TAG",
    "$.embedding", "AS", "embedding",
    "VECTOR", "HNSW", "12",
    "TYPE", "FLOAT32",
    "DIM", "3072",
    "DISTANCE_METRIC", "COSINE",
    "INITIAL_CAP", "110000",
    "M", "16",
    "EF_CONSTRUCTION", "200",
  ]);
  /* eslint-enable */

  process.stdout.write(" Done\n");
}

async function dropIndex(key: string) {
  process.stdout.write(`Dropping index ${key}...`);
  await redis.ft.dropIndex(key).then(() => {}, () => {});
  process.stdout.write(" Done\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  if (flags.has("--flat")) {
    await createSynsetDataIndexFlat();
  }
  if (flags.has("--hnsw")) {
    await createSynsetDataIndexHNSW();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
