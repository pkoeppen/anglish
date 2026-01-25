import type { WordnetPOS } from "@anglish/core";
import type { WordnetEntry, WordnetSynset } from "./types";
import { Buffer } from "node:buffer";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { open } from "node:fs/promises";
import * as path from "node:path";
import * as process from "node:process";
import { redis } from "@anglish/db";
import OpenAI from "openai";
import { SCHEMA_FIELD_TYPE } from "redis";
import yaml from "yaml";
import { dataRoot, repoRoot } from "./constants";
import { makeLimiter } from "./util";
import "colors";

const openai = new OpenAI();

type Cmd = "fetch" | "embed" | "load";

const argv = process.argv.slice(2);
const cmd = (argv[0] ?? "") as Cmd;

if (cmd === "fetch") {
  cloneEnglishWordnet();
}
else if (cmd === "embed") {
  await createSynsetEmbeddings();
}
else if (cmd === "load") {
  await testVectorSearch();
  // await loadSynsetEmbeddings();
}

export async function verifyWordnet() {
  const jsonDir = path.join(dataRoot, "ewn-json");
  if (!fs.existsSync(jsonDir)) {
    console.error("Wordnet JSON directory not found. Please run `pnpm run wordnet:fetch` first.".red);
    process.exit(1);
  }
}

export async function verifySynsetEmbeddings() {
  const embeddingsFile = path.join(dataRoot, "synset_embeddings.jsonl");
  if (!fs.existsSync(embeddingsFile)) {
    console.error("Synset embeddings file not found. Please run 'pnpm run wordnet:embed' first.".red);
    process.exit(1);
  }
}

function cloneEnglishWordnet() {
  const url = "https://github.com/globalwordnet/english-wordnet.git";
  const ewnDir = path.join(dataRoot, "english-wordnet");
  const jsonDir = path.join(dataRoot, "ewn-json");

  if (fs.existsSync(repoRoot)) {
    return jsonDir;
  }

  execSync(`git clone ${url} ${ewnDir}`, { stdio: "inherit" });
  fs.rmSync(jsonDir, { recursive: true, force: true });
  fs.mkdirSync(jsonDir, { recursive: true });
  const yamlDir = path.join(ewnDir, "src", "yaml");
  const files = fs.readdirSync(yamlDir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(yamlDir, file), "utf8");
    const json = yaml.parse(content);
    fs.writeFileSync(path.join(jsonDir, file.replace(".yaml", ".json")), JSON.stringify(json, null, 2));
  }
  return jsonDir;
}

export function loadWordnet(): { entries: Record<string, WordnetEntry>; synsets: Record<string, WordnetSynset> } {
  const ewnJsonDir = path.join(dataRoot, "ewn-json");
  const files = fs.readdirSync(ewnJsonDir);
  const entryFiles = files.filter(f => f.startsWith("entries-"));
  const synsetFiles = files.filter(f => /^(?:adj|adv|noun|verb)\.\w+\.json$/i.test(f));

  let entries: Record<string, WordnetEntry> = {};
  let synsets: Record<string, WordnetSynset> = {};

  for (const file of entryFiles) {
    const content = fs.readFileSync(path.join(ewnJsonDir, file), "utf8");
    const json = JSON.parse(content) as Record<string, WordnetEntry>;
    entries = { ...entries, ...json };
  }
  for (const file of synsetFiles) {
    const content = fs.readFileSync(path.join(ewnJsonDir, file), "utf8");
    const json = JSON.parse(content) as Record<string, WordnetSynset>;
    synsets = { ...synsets, ...json };
  }
  return { entries, synsets };
}

export interface SynsetVec {
  id: string;
  headword: string;
  pos: WordnetPOS;
  embedding: number[];
}

export async function createSynsetEmbeddings() {
  const outFile = path.join(dataRoot, "synset_embeddings.jsonl");
  const outStream = fs.createWriteStream(outFile);
  const { synsets } = loadWordnet();

  const concurrency = 30;
  const run = makeLimiter(concurrency, 4500 / 60);

  console.log(`Creating embeddings for ${Object.keys(synsets).length} synsets`);

  await Promise.all(
    Object.entries(synsets).map(([id, synset]) =>
      run(async () => {
        const definition = synset.definition.shift()!;
        const embedding = await createEmbedding(definition);
        const synsetVec: SynsetVec = {
          id,
          headword: synset.members.shift()!,
          pos: synset.partOfSpeech as WordnetPOS,
          embedding,
        };
        outStream.write(`${JSON.stringify(synsetVec)}\n`);
      }),
    ),
  );

  outStream.end();
}

async function createEmbedding(definition: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: [definition],
  });
  console.log(`GPT: Created embedding for "${definition}"`.blue);
  return response.data[0].embedding;
}

/*
 * Loads synset definition text embeddings into Redis.
 */
async function loadSynsetEmbeddings() {
  await createSynsetEmbeddingIndex();

  const embeddingsFile = path.join(dataRoot, "synset_embeddings.jsonl");
  const embeddingsStream = await open(embeddingsFile);

  console.log(`Loading synset embeddings from ${embeddingsFile}`);

  for await (const line of embeddingsStream.readLines()) {
    const embedding = JSON.parse(line);
    const key = `synset:${embedding.id}`;
    console.log(`Setting ${key}`);
    await redis.json.set(key, "$", embedding);
  }
}

async function createSynsetEmbeddingIndex() {
  const indexKey = `idx:synsets_vss`;
  console.log(`Creating index ${indexKey}`);
  await redis.ft.dropIndex(indexKey, { DD: true }).then(() => {}, () => {});
  await redis.ft.create(indexKey, {
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
    PREFIX: "synset:",
  });
  console.log(`Index ${indexKey} created`);
}

async function testVectorSearch() {
  const indexKey = `idx:synsets_vss`;
  const query = "(* )=>[KNN 3 @vector $query_vector AS vector_score]";

  const q = await redis.json.get(`synset:00003131-a`) as unknown as SynsetVec;
  console.log(`Target:\t${q.headword.green}\n`);

  const float32 = new Float32Array(q.embedding);
  const bytes = Buffer.from(float32.buffer);

  const results = await redis.ft.search(indexKey, query, {
    SORTBY: "vector_score",
    RETURN: ["vector_score"],
    DIALECT: 2,
    PARAMS: {
      query_vector: bytes,
    },
  });

  for (const { id } of results.documents) {
    const synset = await redis.json.get(id) as unknown as SynsetVec;
    console.log(`Result:\t ${synset.headword.blue}`);
  }

  console.log();

  process.exit(0);
}
