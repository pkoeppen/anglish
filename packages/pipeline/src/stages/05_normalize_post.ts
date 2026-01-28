import type { WordOrigin } from "@anglish/core";
import type { NormalizeStageConfig } from "./03_normalize_pre";
import type { MergedRecord } from "./04_merge";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { WordnetPOS } from "@anglish/core";
import OpenAI from "openai";
import { makeLimiter, readJsonl, wordnetReadablePOS } from "../util";
import { getCategoriesByPOS } from "../wordnet/categories";

const openai = new OpenAI();

export interface NormalizePostManifestRow {
  id: string;
  inputPath: string;
  outputPath: string;
  recordsIn: number;
  recordsOut: number;
  normalizedAt: string;
}

export interface PostNormalizedRecord {
  v: 1;
  lemma: string;
  pos: WordnetPOS;
  glosses: {
    text: string;
    category: string | null;
    synonyms: string[];
  }[];
  origins: WordOrigin[];
  sources: string[];
  meta: { normalizedAt: string; [key: string]: unknown };
}

export async function runNormalizeStagePost(config: NormalizeStageConfig): Promise<NormalizePostManifestRow[]> {
  const inDir = path.join(config.dataRoot, "04_merge", "out");
  const outDir = path.join(config.dataRoot, "05_normalize_post");
  const outRecordsDir = path.join(outDir, "out");
  const outManifest = path.join(outDir, "manifest.05_normalize_post.jsonl");

  await fsp.mkdir(outRecordsDir, { recursive: true });

  if (!config.force) {
    // If manifest exists we assume outputs already exist and skip.
    if (fs.existsSync(outManifest))
      return [];
  }

  await fsp.writeFile(outManifest, "", "utf8");

  const mergedRecords: MergedRecord[] = [];
  const inputPath = path.join(inDir, "merged_records.jsonl");

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`.red);
    return [];
  }

  for await (const record of readJsonl<MergedRecord>(inputPath)) {
    mergedRecords.push(record);
  }

  console.log(`Post-normalizing ${mergedRecords.length} merged records`);

  const outputPath = path.join(outRecordsDir, "normalized_post_records.jsonl");
  const w = fs.createWriteStream(outputPath, { flags: "w" });
  const normalizedAt = new Date().toISOString();

  const run = makeLimiter(config.concurrency ?? 100, 1000); // Limiter set according to o4 rate limits
  let recordsOut = 0;

  try {
    await Promise.all(
      mergedRecords.map(record =>
        run(async () => {
          const normalizedRecord: PostNormalizedRecord = {
            v: 1,
            lemma: record.lemma,
            pos: record.pos,
            glosses: [],
            origins: record.origins,
            sources: record.sources,
            meta: { normalizedAt },
          };

          const dedupedGlosses = await gptDedupeGlosses(record.lemma, record.pos, record.glosses);

          if (dedupedGlosses) {
            normalizedRecord.glosses = dedupedGlosses.map(gloss => ({ ...gloss, category: null }));
          }
          else {
            normalizedRecord.glosses = record.glosses.map(gloss => ({ text: gloss, category: null, synonyms: [] }));
          }

          if ([WordnetPOS.Noun, WordnetPOS.Verb].includes(record.pos)) {
            const glossCategories = Array.from(getCategoriesByPOS(record.pos).values());
            for (const [index, gloss] of normalizedRecord.glosses.entries()) {
              const category = await gptCategorizeGloss(
                gloss.text,
                record.pos,
                glossCategories,
              );
              normalizedRecord.glosses[index].category = category;
            }
          }

          w.write(`${JSON.stringify(normalizedRecord)}\n`);
          recordsOut++;
        }),
      ),
    );
  }
  finally {
    await new Promise<void>((resolve, reject) => {
      w.end(() => resolve());
      w.on("error", reject);
    });
  }

  const manifestRow: NormalizePostManifestRow = {
    id: `normalize_post:${normalizedAt}`,
    inputPath,
    outputPath,
    recordsIn: mergedRecords.length,
    recordsOut,
    normalizedAt,
  };

  await fsp.appendFile(outManifest, `${JSON.stringify(manifestRow)}\n`, "utf8");

  return [manifestRow];
}

async function gptDedupeGlosses(word: string, pos: WordnetPOS, glosses: string[]): Promise<{ text: string; synonyms: string[] }[] | null> {
  const systemMessage = `
    You deduplicate dictionary glosses for a single Anglish lemma and part of speech.

    Goal:
    - Identify the distinct senses expressed by the glosses.
    - Merge glosses only if they express the same sense.
    - Keep one short, clear, descriptive gloss per sense.
    - Do NOT introduce new senses.
    - Do NOT keep glosses that are nonsensical for the lemma.
    - Rephrase single-word glosses so they become brief descriptive definitions.
    - Provide synonyms for each sense:
      - Include any glosses that were merged into that sense.
      - Include standard English synonyms if present.
      - Do NOT hallucinate new meanings.
  `.replace(/ +/g, " ").trim();

  const prompt = glosses.map(gloss => `${word} (${wordnetReadablePOS(pos)}): ${gloss}`).join("\n");

  const jsonSchema = {
    type: "object",
    properties: {
      glosses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            synonyms: {
              type: "array",
              items: {
                type: "string",
                description: "A synonym that expresses the same sense as the gloss.",
              },
            },
            text: {
              type: "string",
              description: "The gloss text.",
            },
          },
          required: ["text", "synonyms"],
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

    const parsed = JSON.parse(result) as { glosses: { text: string; synonyms: string[] }[] };

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

async function gptCategorizeGloss(gloss: string, pos: WordnetPOS, possibleCategories: string[]): Promise<string | null> {
  const systemMessage = `
    You assign a dictionary gloss to a single WordNet filename category.
    
    Valid categories:
    ${possibleCategories.join(", ")}
    
    Given the gloss and part of speech, choose exactly ONE category from the list above that best matches the sense.
    
    Rules:
    - Answer with ONE category string from the list.
    - Do NOT invent new categories.
    - Do NOT add explanations or extra text.
    `.replace(/ +/g, " ").trim();

  const prompt
    = `Gloss: ${gloss}\n`
      + `POS: ${wordnetReadablePOS(pos)}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      model: "gpt-4o",
      response_format: {
        type: "text",
      },
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      console.error(`GPT: No gloss category for "${gloss}" (${pos})`.red);
      return null;
    }

    console.log(`GPT: Categorized gloss "${gloss}" (${pos}): ${result}`.blue);

    return result;
  }
  catch (error) {
    console.error(`GPT: Error categorizing gloss "${gloss}" (${pos}):`, error);
    return null;
  }
}
