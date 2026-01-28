import type { WordnetPOS } from "@anglish/core";
import type { DB, Lemma, NewLemma, NewSense, NewSynset } from "@anglish/db";
import process from "node:process";
import { Language, Source } from "@anglish/core";
import { db } from "@anglish/db";
import { PG_MAX_PARAMETERS } from "@anglish/db/constants";
import { loadSynsetsWithCategory, loadWordnet } from "../src/wordnet/wordnet";

await insertSynsets();
const lemmas = await insertLemmas();
await insertSenses(lemmas);

process.exit(0);

function chunk<T>(arr: T[], size: number) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));
}

async function insertRecords<T extends keyof DB>(table: T, records: any[]) {
  const results: any[] = [];
  if (records.length * Object.keys(records[0]).length > PG_MAX_PARAMETERS) {
    console.log(`Inserting ${records.length} records chunkwise into '${table}'...`);
    const chunks = chunk(records, Object.keys(records[0]).length * records.length / PG_MAX_PARAMETERS);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      process.stdout.write(`\r └─ Inserting chunk ${i + 1} of ${chunks.length}`.gray);
      const r = await db.kysely.insertInto(table).values(chunk).returningAll().execute();
      results.push(...r);
    }
    process.stdout.write("\n");
  }
  else {
    console.log(`Inserting ${records.length} records into '${table}'...`);
    const r = await db.kysely.insertInto(table).values(records).returningAll().execute();
    results.push(...r);
  }
  return results;
}

async function insertSynsets() {
  const synsets = loadSynsetsWithCategory();
  const newSynsets: NewSynset[] = [];
  for (const [id, synset] of Object.entries(synsets)) {
    newSynsets.push({
      id,
      pos: synset.partOfSpeech as WordnetPOS,
      gloss: synset.definition[0],
      category: synset.category,
      ili: synset.ili,
      source: Source.Wordnet,
    });
  }

  await insertRecords("synset", newSynsets);
}

async function insertLemmas() {
  const { entries } = loadWordnet();
  const newLemmas: NewLemma[] = [];
  for (const [lemma, entry] of Object.entries(entries)) {
    for (const pos of Object.keys(entry) as WordnetPOS[]) {
      newLemmas.push({
        lemma,
        pos: pos.split("-")[0] as WordnetPOS, // Some POSes are "n-1", "n-2", etc.
        lang: Language.English,
      });
    }
  }
  const lemmas = await insertRecords("lemma", newLemmas);
  return lemmas as Lemma[];
}

async function insertSenses(lemmas: Lemma[]) {
  const { entries } = loadWordnet();
  const newSenses: NewSense[] = [];
  let lemmaIndex = 0;
  for (const entry of Object.values(entries)) {
    for (const posEntry of Object.values(entry)) {
      for (let senseIndex = 0; senseIndex < Object.keys(posEntry.sense).length; senseIndex++) {
        const sense = posEntry.sense[senseIndex];
        newSenses.push({
          lemma_id: lemmas[lemmaIndex].id,
          synset_id: sense.synset,
          sense_index: senseIndex,
          examples: sense.sent || [],
        });
      }
      lemmaIndex++;
    }
  }

  await insertRecords("sense", newSenses);
}
