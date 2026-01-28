import type { NewLemma, NewSense } from "@anglish/db";
import type { VectorSearchResult } from "../wordnet/embedding";
import type { PostNormalizedRecord } from "./05_normalize_post";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { Language, WordnetPOS } from "@anglish/core";
import { db } from "@anglish/db";
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

  const run = makeLimiter(100, 5000);
  const promises = [];

  for await (const record of readJsonl<PostNormalizedRecord>(inputPath)) {
    promises.push(run(async () => {
      const newLemma: NewLemma = {
        lemma: record.lemma,
        pos: record.pos,
        lang: Language.Anglish,
      };
      const lemma = await db.kysely.insertInto("lemma").values(newLemma).returning(["id"]).executeTakeFirstOrThrow();
      for (let i = 0; i < record.glosses.length; i++) {
        const gloss = record.glosses[i];
        const closestSynset = await mapGloss(gloss, record);
        continue;
        const newSense: NewSense = {
          lemma_id: lemma.id,
          synset_id: closestSynset.id,
          sense_index: i,
        };
        console.log(`Inserting sense ${record.lemma} (${record.pos}) -> ${closestSynset.headword}`);
        await db.kysely.insertInto("sense").values(newSense).returning(["id"]).executeTakeFirstOrThrow();
      }
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

  const bestResult = results[0];

  return bestResult;
}
