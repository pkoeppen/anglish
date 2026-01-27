import type { VectorSearchResult } from "../wordnet/embedding";
import type { PostNormalizedRecord } from "./05_normalize_post";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { WordnetPOS } from "@anglish/core";
import { makeLimiter, readJsonl } from "../util";
import { vectorSearch } from "../wordnet/embedding";

export interface MapStageConfig {
  dataRoot: string;
  force?: boolean;
  verbose?: boolean;
}

export async function runMapStage(config: MapStageConfig): Promise<void> {
  const inDir = path.join(config.dataRoot, "05_normalize_post", "out");
  const outDir = path.join(config.dataRoot, "05_map");
  const inputPath = path.join(inDir, "normalized_post_records.jsonl");

  await fsp.mkdir(outDir, { recursive: true });

  if (!config.force) {
    const files = await fsp.readdir(outDir);
    if (files.length > 0) {
      return;
    }
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  console.log(`Reading normalized post records from ${inputPath}`);

  const run = makeLimiter(1000, 5000 / 60);
  const promises = [];

  for await (const record of readJsonl<PostNormalizedRecord>(inputPath)) {
    promises.push(run(async () => {
      for (const gloss of record.glosses) {
        await mapGloss(gloss, record);
      }
      /*

      create table lemma (
        id          bigserial primary key,
        lemma       text not null,             -- "light"
        pos         text not null,             -- 'n', 'v', 'a', 'r' or enum
        language    text not null default 'en' -- or 'an'
        -- plus maybe: spelling_variant_group, etc.
      );

      create table sense (
        id          bigserial primary key,
        lemma_id    bigint not null references lemma(id),
        sense_index smallint not null,         -- 1,2,3 ... for ordering per lemma
        definition  text,                      -- the gloss
        examples    text[],                    -- optional
        category    text,                      -- noun.people, adj.pert, etc
        synset_id   bigint null,
        origins     jsonb[]
      );

      create table synset (
        id         bigserial primary key,      -- Wordnet ids e.g. 12345678
        pos        text not null,
        gloss      text not null,
        source     text,                       -- 'wordnet', 'user'...
      );

      */
    }));
  }

  await Promise.all(promises);
}

async function mapGloss(gloss: PostNormalizedRecord["glosses"][number], record: PostNormalizedRecord) {
  const results = await vectorSearch(gloss.text, record.pos) as (VectorSearchResult & { categoryMatch: boolean })[];

  const scores = results.map(r => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const CATEGORY_BONUS = 0.1;

  for (const r of results) {
    let normalized = (r.score - min) / range;

    if (gloss.category) {
      const isCategoryMatch = [WordnetPOS.Adjective, WordnetPOS.Noun].includes(r.pos) && r.category === gloss.category;
      if (isCategoryMatch) {
        normalized -= CATEGORY_BONUS;
        r.categoryMatch = true;
      }
      r.score = normalized;
    }
  }

  results.sort((a, b) => a.score - b.score);

  console.log(`${record.lemma} (${record.pos}): ${gloss.text}`.green);
  console.log(results.map(r => `  ${r.headword.padEnd(20, " ")}${`(score: ${r.score.toFixed(3)})`.yellow}\t${r.categoryMatch ? "+".green : ""}`).join("\n"));

  // Finally! Write to database!
}
