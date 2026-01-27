import type { WordOrigin } from "@anglish/core";
import type { NormalizedRecord } from "../../stages/03_normalize_pre";
import type { KaikkiSourceRecord } from "./02_parse";
import { OriginKind, OriginLanguage, WordnetPOS } from "@anglish/core";
import OpenAI from "openai";
import { EtymologyTemplateAlias } from "./kaikki-types";

const openai = new OpenAI();

export async function normalize(
  record: KaikkiSourceRecord,
  normalizedAt: string,
): Promise<NormalizedRecord[]> {
  const records: NormalizedRecord[] = [];

  const pos = normalizeKaikkiPOS(record.pos);
  if (!pos) {
    return [];
  }

  const origins = extractKaikkiOrigins(record.etym_templates);

  records.push({
    v: 1,
    source: "kaikki",
    rawId: record.rawId,
    lemma: record.word,
    pos,
    glosses: record.senses,
    origins,
    meta: {
      normalizedAt,
    },
  });

  return records;
}

function normalizeKaikkiPOS(pos: KaikkiSourceRecord["pos"]) {
  switch (pos.toLowerCase()) {
    case "noun":
      return WordnetPOS.Noun;
    case "verb":
      return WordnetPOS.Verb;
    case "adj":
      return WordnetPOS.Adjective;
    case "adv":
      return WordnetPOS.Adverb;
    case "name":
    case "conj":
    case "prep":
    case "prep_phrase":
    case "article":
    case "det":
    case "num":
    case "phrase":
    case "pron":
    case "contraction":
    case "prefix":
    case "suffix":
    case "particle":
    case "character":
    case "symbol":
    case "proverb":
    case "punct":
    case "infix":
    case "interfix":
    case "circumfix":
    case "affix":
    case "adv_phrase":
    case "combining_form":
      return null;
    default:
      return null;
  }
}

function extractKaikkiOrigins(templates: KaikkiSourceRecord["etym_templates"]): WordOrigin[] {
  const origins: WordOrigin[] = [];

  for (const template of templates) {
    let lang = null;
    let kind = null;
    let form = null;

    // Extract language from template expansion
    for (const val of Object.values(OriginLanguage)) {
      if (template.expansion.includes(val)) {
        lang = val;
        break;
      }
    }

    if (!lang) {
      // Lang not found in OriginLanguage, try manual
      if (template.expansion.includes("English")) {
        lang = OriginLanguage.NE;
      }
      else if (template.expansion.includes("German")) {
        lang = OriginLanguage.NHG;
      }
    }

    // Extract kind from template name
    if (EtymologyTemplateAlias.Inherited.includes(template.name)) {
      kind = OriginKind.Inherited;
    }
    else if (EtymologyTemplateAlias.Derived.includes(template.name)) {
      kind = OriginKind.Derived;
    }
    else if (EtymologyTemplateAlias.Borrowed.includes(template.name)) {
      kind = OriginKind.Borrowed;
    }
    else if (EtymologyTemplateAlias.Calque.includes(template.name)) {
      kind = OriginKind.Calque;
    }
    else if (EtymologyTemplateAlias.Cognate.includes(template.name)) {
      kind = OriginKind.Cognate;
    }

    // Extract form from template expansion
    form = template.expansion;

    if (lang && kind && form) {
      origins.push({
        lang,
        kind,
        form,
      });
    }
  }

  return origins;
}

// Manual matcher does a decent job; this is not needed.
async function _gptExtractKaikkiOrigins(
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
    + `{ ${Object.values(OriginLanguage).join(", ")} }\n`
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
              enum: Object.values(OriginLanguage),
              description: "The origin language (use full name, e.g., 'Proto-Germanic' not 'PG')",
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

    const parsed = JSON.parse(result) as { origins: WordOrigin[] };

    // Validate enum values
    const wordOrigins: WordOrigin[] = [];
    for (const origin of parsed.origins) {
      if (Object.values(OriginLanguage).includes(origin.lang)) {
        if (Object.values(OriginKind).includes(origin.kind)) {
          wordOrigins.push({
            lang: origin.lang,
            kind: origin.kind,
            form: typeof origin.form === "string" ? origin.form : "",
          });
        }
      }
    }

    console.log(`kaikki: ${
      (`GPT: Extracted ${wordOrigins.length} origin${wordOrigins.length === 1 ? "" : "s"} `
        + `for "${word}"`).blue}`,
    );

    return wordOrigins;
  }
  catch (error) {
    console.error(`kaikki: ` + `${`Error extracting word origin data: ${error}`.red}`);
    return null;
  }
}
