import type { ParseInput } from "../../stages/02_parse";
import type { KaikkiEntry } from "./kaikki-types";
import crypto from "node:crypto";
import readline from "node:readline";
import { EtymologyTemplateAlias } from "./kaikki-types";
import "colors";

export interface KaikkiSourceRecord {
  v: 1;
  source: "kaikki";
  rawId: string;
  pos: string;
  word: string;
  senses: string[];
  etym_text: string;
  etym_templates: KaikkiEntry["etymology_templates"];
}

async function* parseJsonl(input: ParseInput): AsyncGenerator<KaikkiSourceRecord> {
  const { stream } = input;

  const rl = readline.createInterface({ input: stream!, crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s)
      continue;

    const raw = JSON.parse(s) as KaikkiEntry;

    if (isAnglish(raw)) {
      const senses = raw.senses?.map(sense => sense.glosses?.pop()).filter(s => s !== undefined);
      const data = {
        pos: raw.pos,
        word: raw.word,
        senses,
        etym_text: raw.etymology_text,
        etym_templates: raw.etymology_templates,
      };

      yield {
        v: 1,
        source: "kaikki",
        rawId: stableRawId(data),
        ...data,
      };
    }
  }
}

export async function parse(input: ParseInput): Promise<{
  records: AsyncGenerator<KaikkiSourceRecord>;
}> {
  const { stream } = input;
  if (stream === undefined) {
    throw new Error("Kaikki parser requires a stream, but received full content.");
  }

  return { records: parseJsonl(input) };
}

function stableRawId(data: Record<string, unknown>): string {
  const h = crypto.createHash("sha256");
  h.update(String(data.word || ""));
  h.update("\n");
  h.update(String(data.pos || ""));
  h.update("\n");
  h.update(String(data.etymology_text || ""));
  return h.digest("hex").slice(0, 20);
}

function isAnglish(kaikkiEntry: KaikkiEntry) {
  const etymTemplates = kaikkiEntry.etymology_templates;
  let hasGermanic = false;
  let hasLatin = false;

  if (Array.isArray(etymTemplates)) {
    let foundSource = false;

    for (const template of etymTemplates) {
      // Treat these as first-tier sources
      if (
        EtymologyTemplateAlias.Inherited.includes(template.name)
        || EtymologyTemplateAlias.Derived.includes(template.name)
        || EtymologyTemplateAlias.Borrowed.includes(template.name)
        || EtymologyTemplateAlias.Calque.includes(template.name)
      ) {
        foundSource = true;
        if (/English|Germanic|Norse|Saxon|Frankish/i.test(template.expansion)) {
          hasGermanic = true;
        }
        else if (/French|Latin|Greek/i.test(template.expansion)) {
          hasLatin = true;
        }
      }
    }

    // If no first-tier sources are found, check for cognates
    if (!foundSource) {
      for (const template of etymTemplates) {
        if (EtymologyTemplateAlias.Cognate.includes(template.name)) {
          if (/English|German|Norse|Saxon|Frankish|Danish/i.test(template.expansion)) {
            hasGermanic = true;
          }
          else if (/French|Latin|Greek/i.test(template.expansion)) {
            hasLatin = true;
          }
        }
      }
    }
  }

  return hasGermanic && !hasLatin;
}
