import type { WordOrigin } from "@anglish/core";
import type { NormalizedRecord } from "../../stages/03_normalize";
import type { HurlebatteSourceRecord } from "./02_parse";
import { OriginKind, OriginLanguage, WordnetPOS } from "@anglish/core";
import OpenAI from "openai";
import "colors";

const openai = new OpenAI();

export async function normalize(
  record: HurlebatteSourceRecord,
  normalizedAt: string,
): Promise<NormalizedRecord[]> {
  const parts = record.pos_raw
    .split(/\s*᛭\s*/)
    .filter(s => !!s)
    .map(normalizeHurlebattePOS)
    .filter(p => !!p);

  const defs = record.definition_raw.split(/\s*᛭\s*/).filter(s => !!s);
  const records: NormalizedRecord[] = [];

  if (parts.length > 0 && parts.length !== defs.length) {
    if (parts.length > defs.length) {
      const missingDefs = await gptFillMissingDefinitions(record.lemma_raw, parts, defs);
      if (missingDefs && missingDefs.length === parts.length) {
        defs.length = 0;
        defs.push(...missingDefs);
        console.log(`hurlebatte: ` + `${`GPT: Filled missing definitions for ${record.lemma_raw}`.blue}`);
      }
      else {
        console.error(`hurlebatte: ` + `${`Failed to fill missing definitions for ${record.lemma_raw}`.red}`);
      }
    }
    else if (defs.length > parts.length) {
      const missingParts = await gptFillMissingParts(record.lemma_raw, parts, defs);
      if (missingParts && missingParts.length === defs.length) {
        if (!missingParts.includes(null)) {
          parts.length = 0;
          parts.push(...(missingParts as WordnetPOS[]));
          console.log(`hurlebatte: ` + `${`GPT: Filled missing parts of speech for ${record.lemma_raw}`.blue}`);
        }
      }
      else {
        console.error(`hurlebatte: ` + `${`Failed to fill missing parts for ${record.lemma_raw}`.red}`);
        console.log(record);
      }
    }
  }

  const origins = extractHurlebatteOrigins(record.origin_raw);
  if (origins.length === 0) {
    const gptOrigins = await gptExtractHurlebatteOrigins(record.origin_raw, record.lemma_raw);
    if (gptOrigins) {
      origins.push(...gptOrigins);
    }
    else {
      console.warn(`hurlebatte: ` + `${`Failed to extract origins for ${record.lemma_raw}`.yellow}`);
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const pos = parts[i];
    const def = defs[i];
    if (!def) {
      console.warn(`hurlebatte: ` + `${`No definition for ${record.lemma_raw}:${pos}`.yellow}`);
      continue;
    }
    const gloss = def
      .split(/\s*᛫\s*/)
      .map(s =>
        s
          .replace(/^a(n)?\s+/, "")
          .replace(/\( /g, "(")
          .replace(/ \)/g, ")"),
      )
      .filter(s => !!s)
      .join(", ");

    records.push({
      v: 1,
      source: record.source,
      rawId: record.rawId,
      lemma: record.lemma_raw,
      pos,
      glosses: [gloss],
      origins,
      meta: {
        normalizedAt,
        etymology_raw: record.etymology_raw,
        notes_raw: record.notes_raw,
        tags_raw: record.tags_raw,
        occurrence_index: record.occurrence_index,
      },
    });
  }

  return records;
}

async function gptFillMissingDefinitions(
  lemma: string,
  parts: (WordnetPOS | null)[],
  existingDefs: string[],
): Promise<string[] | null> {
  const systemMessage
    = `You are a dictionary editor. The word you are working with is Anglish (linguistically pure, Germanic English). `
      + `Given a word, its parts of speech, and some existing definitions, `
      + `provide definitions for ALL parts of speech in order. `
      + `Match the existing definitions to the appropriate parts of speech, and generate definitions for the missing ones. `
      + `Return exactly ${parts.length} definitions, one per line, in the same order as the parts of speech. `
      + `Each definition should be a concise dictionary-style definition. `
      + `Do not number or format the definitions, just return them one per line.`;

  const posLabels = parts.map(labelPOS);

  const prompt
    = `Word: ${lemma}\n\nParts of speech (in order): ${posLabels.join(", ")}\n\n`
      + `Existing definitions (may not be in order):\n${existingDefs.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n`
      + `Provide definitions for all ${parts.length} parts of speech in order, one per line. `
      + `Match existing definitions to the correct parts of speech and generate missing ones:`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      model: "gpt-4o",
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      return null;
    }

    const lines = result
      .split("\n")
      .map(line => line.trim())
      .filter(line => !!line)
      .map(line => line.replace(/^\d+\.\s*/, "")); // Remove numbering if present

    if (lines.length === parts.length) {
      return lines;
    }

    return null;
  }
  catch (error) {
    console.error(`hurlebatte: ` + `${`Error filling missing definitions for ${lemma}: ${error}`.red}`);
    return null;
  }
}

async function gptFillMissingParts(
  lemma: string,
  existingParts: (WordnetPOS | null)[],
  defs: string[],
): Promise<(WordnetPOS | null)[] | null> {
  const systemMessage
    = `You are a dictionary editor. The word you are working with is Anglish (linguistically pure, Germanic English).\n`
      + `Given a word, some existing parts of speech, and all definitions,\n`
      + `determine the part of speech for each definition in order.\n`
      + `Match the existing parts of speech to the appropriate definitions, and determine parts of speech for the missing ones.\n`
      + `Return exactly ${defs.length} parts of speech, one per line, in the same order as the definitions.\n`
      + `Use full part-of-speech names: noun, verb, adjective, or adverb.\n`
      + `Do not number or format, just return one part of speech name per line.`;

  const existingPosLabels = existingParts.map(labelPOS);

  const prompt
    = `Word: ${lemma}\n\n`
      + `Existing parts of speech (may not be in order): ${existingPosLabels.join(", ")}\n\n`
      + `All definitions (in order):\n${defs.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n`
      + `Provide the part of speech for all ${defs.length} definitions in order, one per line.\n`
      + `Match existing parts of speech to the correct definitions and determine missing ones:`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      model: "gpt-4o",
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      return null;
    }

    const lines = result
      .split("\n")
      .map(line => line.trim().toLowerCase())
      .filter(line => !!line)
      .map(line => line.replace(/^\d+\.\s*/, "")); // Remove numbering if present

    if (lines.length === defs.length) {
      return lines.map(line => posNameToWordnetPOS(line));
    }

    return null;
  }
  catch (error) {
    console.error(`hurlebatte: ` + `${`Error filling missing parts for ${lemma}: ${error}`.red}`);
    return null;
  }
}

function labelPOS(pos: WordnetPOS | null): string {
  switch (pos) {
    case WordnetPOS.Noun:
      return "noun";
    case WordnetPOS.Verb:
      return "verb";
    case WordnetPOS.Adjective:
      return "adjective";
    case WordnetPOS.Adverb:
      return "adverb";
    default:
      return "unknown";
  }
}

function posNameToWordnetPOS(posName: string): WordnetPOS | null {
  const normalized = posName.trim().toLowerCase();
  if (normalized === "noun" || normalized.startsWith("noun")) {
    return WordnetPOS.Noun;
  }
  if (normalized === "verb" || normalized.startsWith("verb")) {
    return WordnetPOS.Verb;
  }
  if (normalized === "adjective" || normalized.startsWith("adj")) {
    return WordnetPOS.Adjective;
  }
  if (normalized === "adverb" || normalized.startsWith("adv")) {
    return WordnetPOS.Adverb;
  }

  return normalizeHurlebattePOS(normalized);
}

function normalizeHurlebattePOS(pos: string): WordnetPOS | null {
  const normalized = pos.trim().toLowerCase();
  switch (normalized) {
    case "n":
    case "n(p)":
    case "pn":
    case "n(pro)":
      return WordnetPOS.Noun;
    case "v":
      return WordnetPOS.Verb;
    case "aj":
    case "aj(p)":
    case "adj":
      return WordnetPOS.Adjective;
    case "av":
    case "adv":
    case "ad":
      return WordnetPOS.Adverb;
    case "c":
    case "p":
    case "prep":
    case "suffix":
    case "prefix":
    case "i":
    default:
      return null;
  }
}

function extractHurlebatteOrigins(originStr: string): WordOrigin[] {
  const origins: WordOrigin[] = [];
  const sortedLangKeys = Object.keys(OriginLanguage).sort((a, b) => a.length - b.length);

  for (const lang of sortedLangKeys) {
    if (originStr.includes(lang)) {
      origins.push({
        lang: OriginLanguage[lang as keyof typeof OriginLanguage],
        kind: OriginKind.Inherited,
        form: originStr,
      });
      originStr = originStr.replace(lang, "");
    }
  }

  return origins;
}

async function gptExtractHurlebatteOrigins(
  originStr: string,
  word: string,
): Promise<WordOrigin[] | null> {
  const systemMessage = `You are a linguistic data extraction assistant. Your task is to parse etymology/origin strings from the Anglish Moot dictionary and extract structured word origin information.\n`
    + `The origin string may contain:\n`
    + `- Language abbreviations (e.g., "PG", "OE", "ON") that map to specific languages\n`
    + `- Source word forms (e.g., "*bōtuz", "bōt")\n`
    + `- Origin kinds: inherited, derived, borrowed, cognate, compound, or calque\n`
    + `- Multiple origins separated by commas or other delimiters\n`
    + `You must extract word origins and return them as an object with an "origins" property containing an array. Each origin should have:\n`
    + `- lang: One of the OriginLanguage enum values (use the full name, e.g., "Proto-Germanic" not "PG")\n`
    + `- kind: One of: "inherited", "derived", "borrowed", "cognate", "compound", "calque" (or empty string if not provided)\n`
    + `- form: The source word form (e.g., "*bōtuz", "bōt", or empty string if not provided)\n`
    + `Available OriginLanguage values:\n`
    + `{ ${Object.keys(OriginLanguage).join(", ")} }\n`
    + `If you cannot extract valid origins, return an object with an empty array: {"origins": []}.`;

  const prompt = `Extract word origins from this etymology string: "${originStr}"\n`
    + `If the string contains multiple origins, extract all of them.\n`
    + `If no valid origins can be extracted, return an object with an empty array: {"origins": []}.`;

  const jsonSchema = {
    type: "object",
    properties: {
      origins: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lang: {
              type: "string",
              enum: Object.keys(OriginLanguage),
              description: "The origin language (use abbreviation, e.g., 'PG' not 'Proto-Germanic')",
            },
            kind: {
              type: "string",
              enum: Object.values(OriginKind),
              description: "The origin kind: inherited, derived, borrowed, cognate, compound, or calque (or empty string if not provided)",
            },
            form: {
              type: "string",
              description: "The source word form (e.g., '*bōtuz', 'bōt', or empty string if not provided)",
            },
          },
          required: ["lang", "kind", "form"],
          additionalProperties: false,
        },
      },
    },
    required: ["origins"],
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
          name: "word_origins",
          strict: true,
          schema: jsonSchema,
        },
      },
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      return null;
    }

    const parsed = JSON.parse(result) as { origins: (Omit<WordOrigin, "lang"> & { lang: keyof typeof OriginLanguage })[] };

    // Validate enum values
    const wordOrigins: WordOrigin[] = [];
    for (const origin of parsed.origins) {
      if (Object.keys(OriginLanguage).includes(origin.lang)) {
        if (Object.values(OriginKind).includes(origin.kind)) {
          wordOrigins.push({
            lang: OriginLanguage[origin.lang],
            kind: origin.kind,
            form: typeof origin.form === "string" ? origin.form : "",
          });
        }
      }
    }

    console.log(
      `hurlebatte: ${(`GPT: Extracted ${wordOrigins.length} origin${wordOrigins.length === 1 ? "" : "s"} `
        + `for "${word}" (${originStr})`).blue}`,
    );

    return wordOrigins;
  }
  catch (error) {
    console.error(`Error extracting word origin data:`, error);
    return null;
  }
}
