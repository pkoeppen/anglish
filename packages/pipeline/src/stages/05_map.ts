import type { MergedRecord } from "./04_merge";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { readJsonl } from "../util";
import { vectorSearch } from "../wordnet/embedding";

export interface MapStageConfig {
  dataRoot: string;
  force?: boolean;
  verbose?: boolean;
}

export async function runMapStage(config: MapStageConfig): Promise<void> {
  const inDir = path.join(config.dataRoot, "04_merge", "out");
  const outDir = path.join(config.dataRoot, "05_map");
  const inputPath = path.join(inDir, "merged_records.jsonl");

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

  console.log(`Reading merged records from ${inputPath}`);

  for await (const record of readJsonl<MergedRecord>(inputPath)) {
    for (const gloss of record.glosses) {
      const results = await vectorSearch(gloss, record.pos);
      console.log(`${record.lemma} (${record.pos}): ${gloss}`.green);
      console.log(results.map(r => `  ${r.headword.padEnd(20, " ")}${`(score: ${r.score.toFixed(3)})`.yellow}`).join("\n"));
    }
  }
}
