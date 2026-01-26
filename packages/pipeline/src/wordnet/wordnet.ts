import type { WordnetEntry, WordnetSynset } from "../types";
import type { SynsetVec } from "./embedding";
import { Buffer } from "node:buffer";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { redis } from "@anglish/db";
import yaml from "yaml";
import { dataRoot, repoRoot } from "../constants";
import "colors";

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

export function cloneEnglishWordnet() {
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

async function testVectorSearch() {
  const indexKey = `idx:synsets_vss`;
  const k = 20;
  const query = `(* )=>[KNN ${k} @vector $query_vector AS vector_score]`;

  const synsetId = `02086723-n`;

  const q = await redis.json.get(`synset:${synsetId}`) as unknown as SynsetVec;
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
    LIMIT: {
      from: 0,
      size: k,
    },
  });

  for (const { id, value: { vector_score } } of results.documents) {
    const synset = await redis.json.get(id) as unknown as SynsetVec;
    const score = Number(vector_score).toFixed(3);
    console.log(`Result:\t ${synset.headword.padEnd(20, " ").blue}${`(score: ${score})`.yellow}`);
  }

  console.log();

  process.exit(0);
}
