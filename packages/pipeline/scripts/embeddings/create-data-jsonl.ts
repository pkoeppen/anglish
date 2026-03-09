import type { Language, WordnetPOS } from "@anglish/core";
import type { RedisLemmaData, RedisSynsetData } from "@anglish/db";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { makeLimiter, retry } from "@anglish/core";
import { createEmbedding, db } from "@anglish/db";
import { sql } from "kysely";
import { dataRoot } from "../../src/constants";
import { loadWordnetSynsetsWithCategory } from "../../src/lib/wordnet";

export async function createSynsetDataJSONL() {
  const outFile = path.join(dataRoot, "anglish", "redis_synset_data.jsonl");
  const outStream = fs.createWriteStream(outFile);
  const synsets = loadWordnetSynsetsWithCategory();

  const run = makeLimiter(30, 4500);

  console.log(`Creating Redis JSON for ${Object.keys(synsets).length} synsets`);

  await Promise.all(
    Object.entries(synsets).map(([id, synset]) =>
      run(async () => {
        const definition = synset.definition.shift()!;
        const embeddingText = `${synset.members.join(", ")} - ${definition}`;
        const embedding = await retry(() => createEmbedding(embeddingText)); // TODO: Create embedding sidecar for this too
        const data: RedisSynsetData = {
          synset_id: id,
          pos: synset.partOfSpeech as WordnetPOS,
          category: synset.category,
          headword: synset.members[0]!,
          members: synset.members,
          embedding,
        };
        outStream.write(`${JSON.stringify(data)}\n`);
      }),
    ),
  );

  outStream.end();
  await finished(outStream);
}

async function createLemmaDataJSONL() {
  const { rows } = await sql.raw<{
    lemma_id: number;
    sense_id: number;
    synset_id: string;
    lemma: string;
    pos: WordnetPOS;
    lang: Language;
    gloss: string;
  }>(`
    SELECT
      lemma.id AS lemma_id,
      sense.id AS sense_id,
      synset.id AS synset_id,
      lemma.lemma,
      lemma.pos,
      lemma.lang,
      synset.gloss
    FROM lemma
    JOIN sense ON sense.lemma_id = lemma.id
    JOIN synset ON sense.synset_id = synset.id
  `).execute(db.kysely);

  const dataFile = path.join(dataRoot, "anglish", "redis_lemma_data.jsonl");
  const dataStream = fs.createWriteStream(dataFile);
  const embeddingFile = path.join(dataRoot, "anglish", "redis_lemma_data.bin");
  const embeddingStream = fs.createWriteStream(embeddingFile);
  const run = makeLimiter(30, 4500);
  let processedCount = 0;

  console.log(`Creating Redis JSON for ${rows.length} lemma+sense+synsets`);

  await Promise.all(
    rows.map(r =>
      run(async () => {
        const embeddingText = `${r.lemma}: ${r.gloss}`;
        const embedding = await retry(() => createEmbedding(embeddingText));
        const buffer = Buffer.from(Float32Array.from(embedding).buffer);
        const data: Omit<RedisLemmaData, "embedding"> = {
          lemma_id: r.lemma_id,
          sense_id: r.sense_id,
          synset_id: r.synset_id,
          lemma: r.lemma,
          pos: r.pos,
          lang: r.lang,
          gloss: r.gloss,
        };
        dataStream.write(`${JSON.stringify(data)}\n`);
        embeddingStream.write(buffer);
        processedCount++;
        if (processedCount % 500 === 0) {
          process.stdout.write(`\r └─ Processed ${processedCount} lines`.gray);
        }
      }),
    ),
  );

  dataStream.end();
  embeddingStream.end();
  await finished(dataStream);
  await finished(embeddingStream);
  process.stdout.write(`\r └─ Processed ${processedCount} lines\n`.gray);
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  if (flags.has("--synset")) {
    await createSynsetDataJSONL();
  }
  if (flags.has("--lemma")) {
    await createLemmaDataJSONL();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
