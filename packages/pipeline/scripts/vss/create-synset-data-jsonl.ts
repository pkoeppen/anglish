import type { Language, WordnetPOS } from "@anglish/core";
import type { RedisSynsetData } from "@anglish/db";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import process from "node:process";
import { finished } from "node:stream/promises";
import { makeLimiter, retry } from "@anglish/core";
import { createEmbedding, db } from "@anglish/db";
import { sql } from "kysely";
import { SYNSET_DATA_JSONL_PATH, SYNSET_EMBEDDING_BIN_PATH } from "./constants";

async function createSynsetDataJSONL() {
  const { rows } = await sql.raw<{
    id: string;
    pos: WordnetPOS;
    gloss: string;
    members: { lemma: string; lang: Language }[];
  }>(`
    SELECT
      synset.id,
      synset.pos,
      synset.gloss,
      JSONB_AGG(
        DISTINCT JSONB_BUILD_OBJECT('lemma', lemma.lemma, 'lang', lemma.lang)
      ) AS members 
    FROM synset
    JOIN sense ON sense.synset_id = synset.id
    JOIN lemma ON lemma.id = sense.lemma_id
    GROUP BY synset.id;
  `).execute(db.kysely);

  const dataStream = fs.createWriteStream(SYNSET_DATA_JSONL_PATH);
  const embeddingStream = fs.createWriteStream(SYNSET_EMBEDDING_BIN_PATH);
  const run = makeLimiter(30, 4500);
  let processedCount = 0;

  console.log(`Creating Redis JSON for ${rows.length} synsets`);

  await Promise.all(
    rows.map(r =>
      run(async () => {
        const embeddingText = `${r.members.map(m => m.lemma).join(", ")} - ${r.gloss}`;
        const embedding = await retry(() => createEmbedding(embeddingText));
        const buffer = Buffer.from(Float32Array.from(embedding).buffer);
        const data: Omit<RedisSynsetData, "embedding"> = {
          synset_id: r.id,
          pos: r.pos,
          members: r.members,
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
  await createSynsetDataJSONL();
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
