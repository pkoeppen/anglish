import type { WordnetEntry, WordnetSynset } from "../types";
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { WordnetPOS } from "@anglish/core";
import { dataRoot } from "../constants";
import "colors";

export async function verifyWordnet() {
  const jsonDir = path.join(dataRoot, "anglish", "ewn-json");
  if (!fs.existsSync(jsonDir)) {
    console.error("Wordnet JSON directory not found. Please run `pnpm run wordnet:fetch` first.".red);
    process.exit(1);
  }
}

export async function verifySynsetEmbeddings() {
  const embeddingsFile = path.join(dataRoot, "anglish", "synset_embeddings.jsonl");
  if (!fs.existsSync(embeddingsFile)) {
    console.error("Synset embeddings file not found. Please run 'pnpm run wordnet:embed' first.".red);
    process.exit(1);
  }
}

export function loadWordnetEntries(): Record<string, WordnetEntry> {
  const ewnJsonDir = path.join(dataRoot, "anglish", "ewn-json");
  const files = fs.readdirSync(ewnJsonDir);
  const entryFiles = files.filter(f => f.startsWith("entries-"));

  let entries: Record<string, WordnetEntry> = {};

  for (const file of entryFiles) {
    const content = fs.readFileSync(path.join(ewnJsonDir, file), "utf8");
    const json = JSON.parse(content) as Record<string, WordnetEntry>;
    entries = { ...entries, ...json };
  }
  return entries;
}

export function loadWordnetSynsets(): Record<string, WordnetSynset> {
  const ewnJsonDir = path.join(dataRoot, "anglish", "ewn-json");
  const files = fs.readdirSync(ewnJsonDir);
  const synsetFiles = files.filter(f => /^(?:adj|adv|noun|verb)\.\w+\.json$/i.test(f));

  let synsets: Record<string, WordnetSynset> = {};

  for (const file of synsetFiles) {
    const content = fs.readFileSync(path.join(ewnJsonDir, file), "utf8");
    const json = JSON.parse(content) as Record<string, WordnetSynset>;
    synsets = { ...synsets, ...json };
  }
  return synsets;
}

export function loadWordnetSynsetsWithCategory(): Record<string, WordnetSynset & { category: string }> {
  const ewnJsonDir = path.join(dataRoot, "anglish", "ewn-json");
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

export const nounCategories = new Map([
  ["act", "act"],
  ["animal", "animal"],
  ["artifact", "artifact"],
  ["attribute", "attribute"],
  ["body", "body"],
  ["cognition", "cognition"],
  ["communication", "communication"],
  ["event", "event"],
  ["feeling", "feeling"],
  ["food", "food"],
  ["group", "group"],
  ["location", "location"],
  ["motive", "motive"],
  ["object", "object"],
  ["person", "person"],
  ["phenomenon", "phenomenon"],
  ["plant", "plant"],
  ["possession", "possession"],
  ["process", "process"],
  ["quantity", "quantity"],
  ["relation", "relation"],
  ["shape", "shape"],
  ["state", "state"],
  ["substance", "substance"],
  ["time", "time"],
  ["Tops", "Tops"],
]);

export const verbCategories = new Map([
  ["body", "body"],
  ["change", "change"],
  ["cognition", "cognition"],
  ["communication", "communication"],
  ["competition", "competition"],
  ["consumption", "consumption"],
  ["contact", "contact"],
  ["creation", "creation"],
  ["emotion", "emotion"],
  ["motion", "motion"],
  ["perception", "perception"],
  ["possession", "possession"],
  ["social", "social"],
  ["stative", "stative"],
  ["weather", "weather"],
]);

export const adjectiveCategories = new Map([
  ["all", "all"],
  ["pert", "pert"],
  ["ppl", "ppl"],
]);

export const adverbCategories = new Map([
  ["all", "all"],
]);

export function getCategoriesByPOS(pos: WordnetPOS): Map<string, string> {
  switch (pos) {
    case WordnetPOS.Noun:
      return nounCategories;
    case WordnetPOS.Verb:
      return verbCategories;
    case WordnetPOS.Adjective:
      return adjectiveCategories;
    case WordnetPOS.Adverb:
      return adverbCategories;
  }
  throw new Error(`Unknown POS: ${pos}`);
}
