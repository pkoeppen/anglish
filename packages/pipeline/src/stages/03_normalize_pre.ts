import type { WordOrigin } from "@anglish/core";
import type { AnglishMootSourceRecord } from "../sources/anglish_moot/02_parse";
import type { HurlebatteSourceRecord } from "../sources/hurlebatte_wordbook/02_parse";
import type { KaikkiSourceRecord } from "../sources/kaikki/02_parse";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import OpenAI from "openai";
import { makeLimiter, readJsonl } from "../util";

const openai = new OpenAI();

export interface NormalizeManifestRow {
  id: string;
  source: string;
  inputPath: string;
  outputPath: string;
  recordsIn: number;
  recordsOut: number;
  normalizedAt: string;
}

export interface NormalizeStageConfig {
  dataRoot: string;
  force?: boolean;
  verbose?: boolean;
  concurrency?: number;
}

type AnySourceRecord = HurlebatteSourceRecord | AnglishMootSourceRecord | KaikkiSourceRecord;

export interface NormalizedRecord {
  v: 1;
  source: string;
  rawId: string;
  lemma: string;
  pos: string;
  glosses: string[];
  origins: WordOrigin[];
  meta: {
    normalizedAt: string;
    [key: string]: unknown;
  };
}

export type SourceNormalizer<T extends AnySourceRecord = AnySourceRecord> = (
  record: T,
  normalizedAt: string,
) => NormalizedRecord[] | Promise<NormalizedRecord[]>;

export async function runNormalizeStagePre(
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
    if (fs.existsSync(outManifest))
      return [];
  }

  await fsp.writeFile(outManifest, "", "utf8");

  const files = (await fsp.readdir(inDir)).filter(f => f.endsWith(".source_records.jsonl"));
  const results: NormalizeManifestRow[] = [];
  const normalizedAt = new Date().toISOString();

  for (const file of files) {
    const source = file.replace(/\.source_records\.jsonl$/, "");
    const inputPath = path.join(inDir, file);
    const outputPath = path.join(outRecordsDir, `${source}.normalized_records.jsonl`);

    const normalize = normalizers[source];
    if (!normalize) {
      console.warn(`No normalizer for source: ${source}`.red);
      continue;
    }

    // Truncate output file
    await fsp.writeFile(outputPath, "", "utf8");

    let recordsIn = 0;
    let recordsOut = 0;

    // Collect all records first
    const records: AnySourceRecord[] = [];
    for await (const record of readJsonl<AnySourceRecord>(inputPath)) {
      records.push(record);
      recordsIn++;
    }

    console.log(`Pre-normalizing ${records.length} records (${source})`);

    // Process records concurrently
    const concurrency = config.concurrency ?? 20;
    const run = makeLimiter(concurrency);

    const normalizedResults = await Promise.all(
      records.map((record, index) =>
        run(async () => {
          const normalized = await normalize(record, normalizedAt);
          return { index, normalized };
        }),
      ),
    );

    const w = fs.createWriteStream(outputPath, { flags: "a" });
    try {
      // sort by original index to maintain order
      normalizedResults.sort((a, b) => a.index - b.index);
      for (const { normalized } of normalizedResults) {
        if (!normalized.length)
          continue;
        recordsOut += normalized.length;
        for (const record of normalized) {
          w.write(`${JSON.stringify(record)}\n`);
        }
      }
    }
    finally {
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
    await fsp.appendFile(outManifest, `${JSON.stringify(manifestRow)}\n`, "utf8");
  }

  return results;
}

async function gptDedupeGlosses(word: string, pos: WordnetPOS, glosses: string[]): Promise<string[] | null> {
  const systemMessage = `
    You dedupe dictionary glosses for one lemma (Anglish word) and POS.  
    Merge glosses only if they express the *same sense*.  
    If meanings differ, keep both.  
    Keep one short, clear gloss per distinct sense.  
    You may format and rephrase for clarity but must not introduce new senses.
    Omit senses that do not make any sense.
    Rephrase single-word glosses to make them more descriptive.
  `;
  const prompt = glosses.map(gloss => `${word} (${pos}): ${gloss}`).join("\n");

  const jsonSchema = {
    type: "object",
    properties: {
      glosses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
            },
            category: {
              type: "string",
            },
          },
          required: ["text", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["glosses"],
    additionalProperties: false,
  };

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      model: "gpt-4o",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "deduplicated_glosses",
          strict: true,
          schema: jsonSchema,
        },
      },
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      return null;
    }

    const parsed = JSON.parse(result) as { glosses: string[] };

    if (parsed.glosses.length !== glosses.length) {
      console.log(`GPT: Deduplicated ${glosses.length} -> ${parsed.glosses.length} glosses for ${word}:${pos}`.blue);
    }

    return parsed.glosses;
  }
  catch (error) {
    console.error(`Error extracting word origin data:`, error);
    return null;
  }
}
