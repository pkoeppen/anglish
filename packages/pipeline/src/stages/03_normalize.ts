import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { type AnglishMootSourceRecord } from "../sources/anglish_moot/parse";
import { type HurlebatteSourceRecord } from "../sources/hurlebatte_wordbook/parse";
import { type KaikkiSourceRecord } from "../sources/kaikki/parse";

export type NormalizeManifestRow = {
  id: string;
  source: string;
  inputPath: string;
  outputPath: string;
  recordsIn: number;
  recordsOut: number;
  normalizedAt: string;
};

export type NormalizeStageConfig = {
  dataRoot: string;
  force?: boolean;
};

type AnySourceRecord = HurlebatteSourceRecord | AnglishMootSourceRecord | KaikkiSourceRecord;

export type NormalizedRecord = {
  v: 1;
  source: string;
  rawId: string;
  lemma: string;
  pos: string;
  glosses: string[];
  origin?: string;
  meta: {
    normalizedAt: string;
    [key: string]: unknown;
  };
};

export type SourceNormalizer<T extends AnySourceRecord = AnySourceRecord> = (
  record: T,
  normalizedAt: string,
) => NormalizedRecord | null;

export async function runNormalizeStage(
  normalizers: Record<string, SourceNormalizer<any>>,
  config: NormalizeStageConfig,
): Promise<NormalizeManifestRow[]> {
  const inDir = path.join(config.dataRoot, "02_parse", "out");
  const outDir = path.join(config.dataRoot, "03_normalize");
  const outRecordsDir = path.join(outDir, "out");
  const outManifest = path.join(outDir, "manifest.03_normalize.jsonl");

  await fsp.mkdir(outRecordsDir, { recursive: true });

  if (!config.force) {
    // If manifest exists we assume outputs already exist and skip.
    if (fs.existsSync(outManifest)) return [];
  }

  await fsp.writeFile(outManifest, "", "utf8");

  const files = (await fsp.readdir(inDir)).filter((f) => f.endsWith(".source_records.jsonl"));

  const results: NormalizeManifestRow[] = [];
  const normalizedAt = new Date().toISOString();

  for (const file of files) {
    const source = file.replace(/\.source_records\.jsonl$/, "");
    const inputPath = path.join(inDir, file);
    const outputPath = path.join(outRecordsDir, `${source}.normalized_records.jsonl`);

    const normalize = normalizers[source];
    if (!normalize) {
      console.warn(`No normalizer for source: ${source}`.yellow);
      continue;
    }

    // Truncate output file
    await fsp.writeFile(outputPath, "", "utf8");

    let recordsIn = 0;
    let recordsOut = 0;

    const w = fs.createWriteStream(outputPath, { flags: "a" });
    try {
      for await (const record of readJsonl<AnySourceRecord>(inputPath)) {
        recordsIn++;
        const normalized = normalize(record, normalizedAt);
        if (!normalized) continue;
        recordsOut++;
        w.write(JSON.stringify(normalized) + "\n");
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        w.end(() => resolve());
        w.on("error", reject);
      });
    }

    const manifestRow: NormalizeManifestRow = {
      id: `${source}:${normalizedAt}`,
      source,
      inputPath,
      outputPath,
      recordsIn,
      recordsOut,
      normalizedAt,
    };

    results.push(manifestRow);
    await fsp.appendFile(outManifest, JSON.stringify(manifestRow) + "\n", "utf8");
  }

  return results;
}

async function* readJsonl<T>(filePath: string): AsyncGenerator<T> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    yield JSON.parse(s) as T;
  }
}
