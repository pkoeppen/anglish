import type { WordnetPOS } from "@anglish/core";
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
import { getCategoriesByPOS } from "./categories";
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

export function loadSynsetsWithCategory(): Record<string, WordnetSynset & { category: string }> {
  const ewnJsonDir = path.join(dataRoot, "ewn-json");
  const synsets: Record<string, WordnetSynset & { category: string }> = {};
  const files = fs.readdirSync(ewnJsonDir).filter(f => /^(?:adj|adv|noun|verb)\.\w+\.json$/i.test(f));

  for (const file of files) {
    const category = file.split(".")[1];
    const content = fs.readFileSync(path.join(ewnJsonDir, file), "utf8");
    const json = JSON.parse(content) as Record<string, WordnetSynset>;
    for (const [id, synset] of Object.entries(json)) {
      synsets[id] = { ...synset, category };
    }
  }

  return synsets;
}
