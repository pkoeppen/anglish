import type { WordnetPOS, WordOrigin } from "@anglish/core";
import type { WordnetPOSEntry } from "../types";
import type { NormalizedRecord } from "./03_normalize_pre";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { readJsonl } from "../util";
import { loadWordnet } from "../wordnet/wordnet";

export interface MergeManifestRow {
  id: string;
  inputPath: string;
  outputPath: string;
  recordsIn: number;
  recordsOut: number;
  mergedAt: string;
}

export interface MergeStageConfig {
  dataRoot: string;
  force?: boolean;
  verbose?: boolean;
}

export interface MergedRecord {
  v: 1;
  lemma: string;
  pos: WordnetPOS;
  glosses: string[];
  origins: WordOrigin[];
  sources: string[];
  meta: {
    mergedAt: string;
    [key: string]: unknown;
  };
}

export type Merger = (
  records: NormalizedRecord[],
  mergedAt: string,
) => MergedRecord[] | Promise<MergedRecord[]>;

/**
 * Default merge function that combines normalized records by lemma+pos.
 * Groups records with the same lemma and part of speech, then merges their
 * glosses, origins, sources, and metadata.
 */
export async function defaultMerge(records: NormalizedRecord[], mergedAt: string): Promise<MergedRecord[]> {
  if (records.length === 0)
    return [];

  const { entries } = loadWordnet();

  // Key by lemma+pos
  const groups = new Map<string, NormalizedRecord[]>();
  for (const record of records) {
    const wordnetPOSEntry: WordnetPOSEntry | undefined
      = entries[record.lemma]?.[record.pos as WordnetPOS];

    if (wordnetPOSEntry) {
      // Wordnet already has this word/pos combo
      continue;
    }
    if (record.glosses.length === 0) {
      console.error(`No glosses for ${record.lemma}:${record.pos}`.yellow);
      continue;
    }

    const key = `${record.lemma}:${record.pos}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const merged: (Omit<MergedRecord, "glosses"> & { glosses: string[] })[] = [];

  for (const [key, group] of groups.entries()) {
    const [lemma, pos] = key.split(":", 2) as [string, WordnetPOS];

    // Collect unique glosses
    const glossSet = new Set<string>();
    for (const record of group) {
      for (const gloss of record.glosses) {
        glossSet.add(gloss);
      }
    }

    // Collect unique origins
    const originMap = new Map<string, WordOrigin>();
    for (const record of group) {
      for (const origin of record.origins) {
        const originKey = `${origin.lang}:${origin.kind}:${origin.form}`;
        if (!originMap.has(originKey)) {
          originMap.set(originKey, origin);
        }
      }
    }

    // Collect sources
    const sources = Array.from(new Set(group.map(r => r.source)));

    // Merge metadata
    const meta: { mergedAt: string; [key: string]: unknown } = { mergedAt };
    for (const record of group) {
      for (const [key, value] of Object.entries(record.meta)) {
        if (key !== "normalizedAt") {
          meta[key] = value;
        }
      }
    }

    merged.push({
      v: 1,
      lemma,
      pos,
      glosses: Array.from(glossSet).sort(),
      origins: Array.from(originMap.values()),
      sources: sources.sort(),
      meta,
    });
  }

  return merged;
}

export async function runMergeStage(
  config: MergeStageConfig,
  merger?: Merger,
): Promise<MergeManifestRow[]> {
  const inDir = path.join(config.dataRoot, "03_normalize", "out");
  const outDir = path.join(config.dataRoot, "04_merge");
  const outRecordsDir = path.join(outDir, "out");
  const outManifest = path.join(outDir, "manifest.04_merge.jsonl");

  await fsp.mkdir(outRecordsDir, { recursive: true });

  if (!config.force) {
    // If manifest exists we assume outputs already exist and skip.
    if (fs.existsSync(outManifest))
      return [];
  }

  await fsp.writeFile(outManifest, "", "utf8");

  const files = (await fsp.readdir(inDir)).filter(f => f.endsWith(".normalized_records.jsonl"));
  const results: MergeManifestRow[] = [];
  const mergedAt = new Date().toISOString();

  // Collect all normalized records from all sources
  const allRecords: NormalizedRecord[] = [];
  const sourceFiles: Array<{ source: string; path: string; count: number }> = [];

  for (const file of files) {
    const source = file.replace(/\.normalized_records\.jsonl$/, "");
    const inputPath = path.join(inDir, file);

    let count = 0;
    for await (const record of readJsonl<NormalizedRecord>(inputPath)) {
      allRecords.push(record);
      count++;
    }

    sourceFiles.push({ source, path: inputPath, count });
  }

  console.log(`Merging ${allRecords.length} normalized records from ${sourceFiles.length} sources`);

  // Use provided merger or fall back to default
  const mergeFn = merger ?? defaultMerge;
  const merged = await mergeFn(allRecords, mergedAt);

  const skippedCount = allRecords.length - merged.length;
  console.log(`Skipped ${skippedCount} records (already in Wordnet)`);

  const outputPath = path.join(outRecordsDir, "merged_records.jsonl");
  const w = fs.createWriteStream(outputPath, { flags: "w" });

  try {
    for (const record of merged) {
      w.write(`${JSON.stringify(record)}\n`);
    }
  }
  finally {
    await new Promise<void>((resolve, reject) => {
      w.end(() => resolve());
      w.on("error", reject);
    });
  }

  const manifestRow: MergeManifestRow = {
    id: `merge:${mergedAt}`,
    inputPath: inDir,
    outputPath,
    recordsIn: allRecords.length,
    recordsOut: merged.length,
    mergedAt,
  };

  results.push(manifestRow);
  await fsp.appendFile(outManifest, `${JSON.stringify(manifestRow)}\n`, "utf8");

  return results;
}
