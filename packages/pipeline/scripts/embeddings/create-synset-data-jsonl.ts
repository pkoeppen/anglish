import type { Language, WordnetPOS } from "@anglish/core";
import type { RedisSynsetData } from "@anglish/db";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createEmbedding, db } from "@anglish/db";
import { sql } from "kysely";
import { dataRoot } from "../../src/constants";
import { makeLimiter, retry } from "../../src/lib/util";
import { loadWordnetSynsetsWithCategory } from "../../src/lib/wordnet";

export async function createSynsetDataJSONLWordnet() {
  const filename = "redis_synset_data_wordnet.jsonl";
  const outFile = path.join(dataRoot, "anglish", filename);
  const outStream = fs.createWriteStream(outFile);
  const synsets = loadWordnetSynsetsWithCategory();

  const concurrency = 30;
  const run = makeLimiter(concurrency, 4500);

  console.log(`Creating Redis JSON for ${Object.keys(synsets).length} synsets (${filename})`);

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

export async function createSynsetDataJSONLFull() {
  const filename = "redis_synset_data_full.jsonl";
  const outFile = path.join(dataRoot, "anglish", filename);
  const outStream = fs.createWriteStream(outFile);
  const { rows: synsets } = await sql.raw<{
    id: string;
    pos: WordnetPOS;
    category: string;
    gloss: string;
    members: { lemma: string; lang: Language }[];
  }>(`
    WITH members AS (
      SELECT DISTINCT l.lemma, l.lang, s.synset_id
      FROM lemma l
      JOIN sense s ON s.lemma_id = l.id
    )
    SELECT s.id,
           s.pos,
           s.category,
           s.gloss,
           JSONB_AGG(
             JSONB_BUILD_OBJECT('lemma', m.lemma, 'lang', m.lang)
           ) AS members
    FROM synset s
    LEFT JOIN members m ON m.synset_id = s.id
    GROUP BY s.id;
  `).execute(db.kysely);

  const concurrency = 30;
  const run = makeLimiter(concurrency, 4500);

  console.log(`Creating Redis JSON for ${Object.keys(synsets).length} synsets (${filename})`);

  await Promise.all(
    synsets.map(synset =>
      run(async () => {
        const embeddingText = `${synset.members.map(m => m.lemma).join(", ")} - ${synset.gloss}`;
        const embedding = await retry(() => createEmbedding(embeddingText));
        const data: RedisSynsetData = {
          synset_id: synset.id,
          pos: synset.pos,
          category: synset.category,
          headword: synset.members[0]!.lemma,
          members: synset.members,
          embedding,
        };
        outStream.write(`${JSON.stringify(data)}\n`);
      }),
    ),
  );

  outStream.end();
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  if (flags.has("--wordnet")) {
    await createSynsetDataJSONLWordnet();
  }
  if (flags.has("--full")) {
    await createSynsetDataJSONLFull();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
