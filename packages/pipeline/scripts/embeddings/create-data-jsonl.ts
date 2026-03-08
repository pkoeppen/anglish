import type { Language, WordnetPOS } from "@anglish/core";
import type { RedisLemmaData, RedisSynsetData } from "@anglish/db";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
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
        const embedding = await retry(() => createEmbedding(embeddingText));
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
}

async function createLemmaDataJSONL() {
  const { rows: lemmas } = await sql.raw<{
    lemma: string;
    pos: WordnetPOS;
    lang: Language;
    synonyms: string[];
    gloss: string;
  }>(`
    SELECT
      lemma.lemma,
      lemma.pos,
      lemma.lang,
      ARRAY_AGG(comember.lemma) FILTER (WHERE comember IS NOT NULL) AS synonyms,
      synset.gloss
    FROM lemma
    JOIN sense ON sense.lemma_id = lemma.id
    JOIN synset ON sense.synset_id = synset.id
    LEFT JOIN LATERAL (
      SELECT DISTINCT l.lemma
      FROM lemma l
      JOIN sense s ON s.lemma_id = l.id
      WHERE s.synset_id = synset.id
      AND l.lemma <> lemma.lemma
    ) comember ON TRUE
    GROUP BY lemma.lemma, lemma.pos, lemma.lang, synset.gloss;
  `).execute(db.kysely);

  const outFile = path.join(dataRoot, "anglish", "redis_lemma_data.jsonl");
  const outStream = fs.createWriteStream(outFile);
  const run = makeLimiter(30, 4500);

  console.log(`Creating Redis JSON for ${lemmas.length} lemmas`);

  await Promise.all(
    lemmas.map(({ lemma, pos, lang, synonyms, gloss }) =>
      run(async () => {
        const embeddingText = `${lemma} - ${synonyms ? `${synonyms.join(", ")} - ` : ""}${gloss}`;
        const embedding = await retry(() => createEmbedding(embeddingText));
        const data: RedisLemmaData = {
          lemma,
          pos,
          lang,
          embedding,
        };
        outStream.write(`${JSON.stringify(data)}\n`);
      }),
    ),
  );
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
