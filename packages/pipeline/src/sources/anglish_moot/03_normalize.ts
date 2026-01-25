import type { WordOrigin } from "@anglish/core";
import type { NormalizedRecord } from "../../stages/03_normalize";
import type { AnglishMootSourceRecord } from "./02_parse";
import { OriginKind, OriginLanguage, WordnetPOS } from "@anglish/core";
import OpenAI from "openai";
import { wordPattern, wordRegex } from "../../util";
import { AnglishMootAbbreviation } from "./abbreviations";
import "colors";

const openai = new OpenAI();

// Load abbreviations for the origins pattern
const originsPattern = `(${Object.keys(AnglishMootAbbreviation)
  .map(s => s.replace(".", ""))
  .join("|")})`;
const originRegExp = new RegExp(`^${originsPattern}$`, "i");

export async function normalize(
  record: AnglishMootSourceRecord,
  normalizedAt: string,
): Promise<NormalizedRecord[]> {
  const records: NormalizedRecord[] = [];

  const cleanedWord = cleanWordString(record.lemma_raw);
  const isWord = cleanedWord !== null && wordRegex.test(cleanedWord);

  if (isWord) {
    const wasChanged = cleanedWord !== record.lemma_raw;
    if (wasChanged)
      console.warn(`anglish_moot: ${`${record.lemma_raw} -> ${cleanedWord}`.yellow}`);

    const parts = normalizeAnglishMootPOS(record.pos_raw);

    for (const pos of parts.values()) {
      // Break unique parts of speech into separate records
      if (record.dictionary === "english_to_anglish") {
        // Extract Anglish word(s) from definition.
        // Converts english->anglish[] to (anglish->english)[]
        const anglishGlosses = [record.attested_raw.text, record.unattested_raw.text];
        const extractedEntries = anglishGlosses.flatMap(gloss => extractAnglishEntries(gloss, cleanedWord));

        for (const entry of extractedEntries) {
          const normalizedRecord: NormalizedRecord = {
            v: 1,
            source: "anglish_moot",
            rawId: record.rawId,
            lemma: entry.word,
            pos,
            glosses: [entry.gloss],
            origins: [],
            meta: {
              normalizedAt,
            },
          };

          if (entry.origin !== undefined) {
            const origins = extractAnglishMootOrigins(entry.origin);
            // Skip GPT matching here; the origin string sucks
            normalizedRecord.origins = origins;
          }

          records.push(normalizedRecord);
        }
      }
      else {
        // Already anglish->english
        const origins = await gptExtractAnglishMootOrigins(record.definition_raw.text, cleanedWord) || [];
        const [gloss] = record.definition_raw.text.split(/[[\]]/g);

        const normalizedRecord: NormalizedRecord = {
          v: 1,
          source: "anglish_moot",
          rawId: record.rawId,
          lemma: cleanedWord,
          pos,
          glosses: [gloss],
          origins,
          meta: {
            normalizedAt,
          },
        };

        records.push(normalizedRecord);
      }
    }
  }

  return records;
}

function cleanWordString(word: string): string | null {
  word = word
    .replace(/\([^)]*\)/g, "") // Remove (parentheses)
    .replace(/\[[^\]]*\]/g, "") // Remove [square brackets]
    .replace(/\n.*$/g, "") // Remove anything that comes after a newline
    .replace(/\s+/g, " ") // Remove extra spaces between words
    .trim();

  if (!wordRegex.test(word)) {
    const match = word.match(new RegExp(`^${wordPattern}(?=\\s*[\/,])`, "iu"));
    if (!match)
      return null;
    word = match[0];
  }

  return word;
}

function normalizeAnglishMootPOS(posString: string) {
  const parts: Set<WordnetPOS> = new Set();
  const partsRaw = posString
    .replace(/\s/g, "") // Remove spaces
    .split(/\W/) // Split on non-word characters
    .filter(str => str);

  for (const posRaw of partsRaw) {
    switch (posRaw.toLowerCase()) {
      case "noun":
      case "n":
      case "p":
        parts.add(WordnetPOS.Noun);
        break;
      case "verb":
      case "vb":
      case "vt":
      case "v":
        parts.add(WordnetPOS.Verb);
        break;
      case "adj":
        parts.add(WordnetPOS.Adjective);
        break;
      case "adv":
        parts.add(WordnetPOS.Adverb);
        break;
      case "conj":
      case "prep":
        break;
    }
  }

  return parts;
}

function extractAnglishEntries(anglishGloss: string, cleanedEnglishWord: string) {
  anglishGloss = anglishGloss
    .replace(/(?:^|\n).*?:/g, "") // Remove text coming before a colon
    .trim();

  const regex = new RegExp(
    `(?<!\\()(?<words>${wordPattern}(, (${wordPattern})?)*)(?!\\))(\\s?\\((?<origin>[^\)]*)\\))?`,
    "giu",
  );

  const matches = anglishGloss.matchAll(regex);
  const entries = [];

  if (matches) {
    for (const match of matches) {
      const origin = match.groups?.origin;
      const words = match.groups?.words;

      if (words) {
        for (const wordString of words.split(/[,;]/)) {
          const cleanedAnglishWord = cleanWordString(wordString);
          if (!cleanedAnglishWord || originRegExp.test(cleanedAnglishWord)) {
            continue;
          }

          entries.push({
            word: cleanedAnglishWord,
            gloss: cleanedEnglishWord,
            origin,
          });
        }
      }
    }
  }

  return entries;
}

function extractAnglishMootOrigins(originStr: string): WordOrigin[] {
  const origins: WordOrigin[] = [];
  const sortedLangKeys = Object.keys(OriginLanguage).sort((a, b) => b.length - a.length);

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

async function gptExtractAnglishMootOrigins(
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

    console.log(`anglish_moot: ${
      (`GPT: Extracted ${wordOrigins.length} origin${wordOrigins.length === 1 ? "" : "s"} `
        + `for "${word}" (${originStr})`).blue}`,
    );

    return wordOrigins;
  }
  catch (error) {
    console.error(`anglish_moot: ${`Error extracting word origin data: ${error}`.red}`);
    return null;
  }
}
