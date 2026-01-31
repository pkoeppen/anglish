import type { WordnetPOS } from "@anglish/core";
import type { DB, Lemma, NewLemma, NewSense, NewSenseSense, NewSynset, NewSynsetSynset, Sense, Synset, SynsetSynset } from "@anglish/db";
import type { Selectable } from "kysely";
import type { WordnetSense } from "../src/types";
import process from "node:process";
import { Language, SenseRelation, Source, SynsetRelation } from "@anglish/core";
import { db } from "@anglish/db";
import { PG_MAX_PARAMETERS } from "@anglish/db/constants";
import { loadWordnetEntries, loadWordnetSynsetsWithCategory } from "../src/lib/wordnet";

function chunk<T>(arr: T[], size: number) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));
}

async function insertRecords<T extends keyof DB>(table: T, records: any[]): Promise<Selectable<DB[T]>[]> {
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
  const newSynsets: NewSynset[] = [];
  iterateWordnetSynsets((synset, synsetId) => {
    newSynsets.push({
      id: synsetId,
      pos: synset.partOfSpeech as WordnetPOS,
      gloss: synset.definition[0],
      category: synset.category,
      ili: synset.ili,
      source: Source.Wordnet,
    });
  });

  const insertedSynsets = await insertRecords("synset", newSynsets);
  return insertedSynsets;
}

async function insertLemmas() {
  const entries = loadWordnetEntries();
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
  const insertedLemmas = await insertRecords("lemma", newLemmas);
  return insertedLemmas;
}

async function insertSenses(lemmas: Lemma[]) {
  const newSenses: (NewSense & { wordnetId: string })[] = [];
  iterateWordnetSenses((wordnetSense, senseIndex, lemmaIndex) => {
    newSenses.push({
      wordnetId: wordnetSense.id,
      lemma_id: lemmas[lemmaIndex].id,
      synset_id: wordnetSense.synset,
      examples: wordnetSense.sent || [],
    });
  });

  const insertedSenses = await insertRecords("sense", newSenses.map((s) => {
    const { wordnetId, ...sense } = s;
    return sense;
  }));
  return insertedSenses.map(
    (s, index) => ({ ...s, wordnetId: newSenses[index].wordnetId }),
  );
}

async function insertSenseRelations(senses: (Sense & { wordnetId: string })[]) {
  const sensesByWordnetId: Record<string, Sense> = {};
  for (const sense of senses) {
    sensesByWordnetId[sense.wordnetId] = sense;
  }

  const senseRelations: NewSenseSense[] = [];

  iterateWordnetSenses((wordnetSense) => {
    const dbSenseA = sensesByWordnetId[wordnetSense.id];
    const relations = Object.keys(wordnetSense)
      .filter((key): key is SenseRelation => Object.values(SenseRelation).includes(key as SenseRelation));
    for (const relation of relations) {
      const targetSenseIds = wordnetSense[relation]!;
      for (const targetSenseId of targetSenseIds) {
        const dbSenseB = sensesByWordnetId[targetSenseId];
        senseRelations.push({
          sense_id_a: dbSenseA.id,
          sense_id_b: dbSenseB.id,
          relation: relation as SenseRelation,
        });
      }
    }
  });

  await insertRecords("sense_sense", senseRelations);
}

async function insertSynsetRelations(synsets: Synset[]) {
  const synsetsById: Record<string, Synset> = {};
  for (const synset of synsets) {
    synsetsById[synset.id] = synset;
  }

  const synsetRelations: NewSynsetSynset[] = [];

  iterateWordnetSynsets((wordnetSynset, synsetId) => {
    const dbSynsetA = synsetsById[synsetId];
    const relations = Object.keys(wordnetSynset)
      .filter((key): key is SynsetRelation => Object.values(SynsetRelation).includes(key as SynsetRelation));
    for (const relation of relations) {
      const targetSynsetIds = wordnetSynset[relation]!;
      for (const targetSynsetId of targetSynsetIds) {
        const dbSynsetB = synsetsById[targetSynsetId];
        synsetRelations.push({
          synset_id_a: dbSynsetA.id,
          synset_id_b: dbSynsetB.id,
          relation: relation as SynsetRelation,
        });
      }
    }
  });

  await insertRecords("synset_synset", synsetRelations);
}

function iterateWordnetSenses(
  callback: (sense: WordnetSense, senseIndex: number, lemmaIndex: number) => void,
) {
  const entries = loadWordnetEntries();
  let lemmaIndex = 0;
  for (const entry of Object.values(entries)) {
    for (const posEntry of Object.values(entry)) {
      for (let senseIndex = 0; senseIndex < Object.keys(posEntry.sense).length; senseIndex++) {
        const sense = posEntry.sense[senseIndex];
        callback(sense, senseIndex, lemmaIndex);
      }
      lemmaIndex++;
    }
  }
}

function iterateWordnetSynsets(
  callback: (synset: ReturnType<typeof loadWordnetSynsetsWithCategory>[number], synsetId: string) => void,
) {
  const synsets = loadWordnetSynsetsWithCategory();
  for (const [synsetId, synset] of Object.entries(synsets)) {
    callback(synset, synsetId);
  }
}

async function main() {
  const synsets = await insertSynsets();
  const lemmas = await insertLemmas();
  const senses = await insertSenses(lemmas);
  await insertSenseRelations(senses);
  await insertSynsetRelations(synsets);
}

main().then(() => {
  process.exit(0);
});
