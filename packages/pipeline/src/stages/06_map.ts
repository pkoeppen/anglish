import type { NewLemma, NewSense } from "@anglish/db";
import type { SynsetEmbeddingJSON } from "../types";
import type { PostNormalizedRecord } from "./05_normalize_post";
import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { Language, WordnetPOS } from "@anglish/core";
import { db, redis } from "@anglish/db";
import { REDIS_VSS_FLAT_INDEX } from "../constants";
import { createEmbedding } from "../lib/gpt";
import { makeLimiter, readJsonl } from "../lib/util";

export interface MapStageConfig {
  dataRoot: string;
  force?: boolean;
  verbose?: boolean;
}

export async function runMapStage(config: MapStageConfig): Promise<void> {
  const inDir = path.join(config.dataRoot, "anglish", "05_normalize_post", "out");
  const outDir = path.join(config.dataRoot, "anglish", "05_map");
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
        const closestSynset = await mapGloss(gloss, record.lemma, record.pos);
        const newSense: NewSense = {
          lemma_id: lemma.id,
          synset_id: closestSynset.id,
        };
        console.log(`Inserting sense ${record.lemma} (${record.pos}) -> ${closestSynset.headword}`);
        await db.kysely.insertInto("sense").values(newSense).returning(["id"]).executeTakeFirstOrThrow();
      }
    }));
  }

  await Promise.all(promises);
}

export async function mapGloss(gloss: PostNormalizedRecord["glosses"][number], lemma: string, pos: WordnetPOS) {
  const results = await vectorSearchJSON(gloss.text, pos) as (VectorSearchResult & { categoryMatch: boolean })[];

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

  // console.log(`${lemma} (${pos}): ${gloss.text}`.green);
  // console.log(results.map(r => `  ${r.headword.padEnd(20, " ")}${`(score: ${r.score.toFixed(3)})`.yellow}\t${r.categoryMatch ? "+".green : ""}`).join("\n"));

  const bestResult = results[0];

  return bestResult;
}

interface VectorSearchResult {
  id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  score: number;
}

async function vectorSearchJSON(text: string, pos: WordnetPOS, k = 20): Promise<VectorSearchResult[]> {
  const embedding = await createEmbedding(text);

  const query = `@pos:{${pos}} =>[KNN ${k} @vector $query_vector AS score]`;
  const float32 = new Float32Array(embedding);
  const bytes = Buffer.from(float32.buffer);

  const results = await redis.ft.search(REDIS_VSS_FLAT_INDEX, query, {
    SORTBY: "score",
    RETURN: ["score", "pos"],
    DIALECT: 2,
    PARAMS: {
      query_vector: bytes,
    },
    LIMIT: {
      from: 0,
      size: k,
    },
  });

  const synsets = await Promise.all(results.documents.map(async ({ id, value: { score } }) => {
    const synset = await redis.json.get(id) as unknown as SynsetEmbeddingJSON;
    return {
      id: synset.id,
      pos: synset.pos,
      category: synset.category,
      headword: synset.headword,
      score: Number(score),
    };
  }));

  return synsets;
}
