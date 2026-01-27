// Load merged records
// For each record
// For each gloss, by its pos, GPT attach a Wordnet category to it (from filename)
// Update MergedRecord type

import type { WordnetPOS } from "@anglish/core";
import type { MergedRecord } from "../src/stages/04_merge";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";
import { readJsonl } from "../src/util";
import { getCategoriesByPOS } from "../src/wordnet/categories";
import "colors";

const openai = new OpenAI();

const filePath = path.join(process.cwd(), "data", "anglish", "04_merge", "out", "merged_records.jsonl");
const mergedOld = await readJsonl<Omit<MergedRecord, "glosses"> & { glosses: string[] }>(filePath);

const merged: MergedRecord[] = [];

for await (const record of mergedOld) {
  console.log(`${record.lemma}:${record.pos}`.green);
  const possibleCategories = Array.from(getCategoriesByPOS(record.pos).values());
  const glosses = await Promise.all(record.glosses.map(async (gloss) => {
    const category = await gptCategorizeGloss(gloss, record.pos, possibleCategories);
    return { text: gloss, category };
  }));

  merged.push({
    v: 1,
    lemma: record.lemma,
    pos: record.pos,
    glosses,
    origins: record.origins,
    sources: record.sources,
    meta: record.meta,
  });
}

async function gptCategorizeGloss(gloss: string, pos: WordnetPOS, possibleCategories: string[]): Promise<string | null> {
  const systemMessage = `
    You categorize a dictionary gloss into one of the following categories:
    ${possibleCategories.join(", ")}
    Return the category that best matches the gloss.
  `;
  const prompt = `${gloss}`;

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
      console.error(`GPT: No result for "${gloss}" (${pos})`.red);
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
