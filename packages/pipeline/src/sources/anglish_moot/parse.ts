import * as cheerio from "cheerio";
import crypto from "node:crypto";
import type { ParseInput } from "../../stages/02_parse";

export type Cell = {
  text: string;
  html: string;
};

type ParsedRowBase = {
  dictionary: "english_to_anglish" | "anglish_to_english";
  page_id: string;
  occurrence_index: number;
  lemma_raw: string;
  pos_raw: string;
  cells_raw: Record<string, Cell>;
};

type ParsedE2A = ParsedRowBase & {
  dictionary: "english_to_anglish";
  attested_raw: Cell;
  unattested_raw: Cell;
};

type ParsedA2E = ParsedRowBase & {
  dictionary: "anglish_to_english";
  definition_raw: Cell;
  origin_raw: Cell | null;
};

type ParsedRow = ParsedE2A | ParsedA2E;

export type AnglishMootSourceRecord = {
  v: 1;
  source: "anglish_moot";
  rawId: string;
  meta?: Record<string, unknown>;
} & ParsedRow;

export async function parse(input: ParseInput): Promise<{
  records: AnglishMootSourceRecord[];
}> {
  const { content, jobMeta, fetch } = input;
  if (content === undefined) {
    throw new Error("AnglishMoot parser requires full content, but received a stream.");
  }
  const $ = cheerio.load(content);
  const records: AnglishMootSourceRecord[] = [];

  const dictionary = jobMeta?.dictionary;
  const occurrenceCounters = new Map<string, number>();

  const rows = Array.from($("table > tbody > tr"));

  rows.forEach((el) => {
    const cells = Array.from($(el).children("td")).map((cell) => ({
      text: $(cell).text().trim(),
      html: $(cell).html()?.trim() || "",
    }));

    if (dictionary === "english_to_anglish") {
      if (cells.length === 4) {
        const [word, pos, attested, unattested] = cells;

        if (!word.text) return;

        const identityKey = `${word.text}:${pos.text}`;
        const occurrence_index = occurrenceCounters.get(identityKey) ?? 0;
        occurrenceCounters.set(identityKey, occurrence_index + 1);

        const data: ParsedE2A = {
          dictionary: "english_to_anglish",
          page_id: fetch.id,
          occurrence_index,
          lemma_raw: word.text,
          pos_raw: pos.text,
          cells_raw: {
            word: word,
            pos: pos,
            attested: attested,
            unattested: unattested,
          },
          attested_raw: attested,
          unattested_raw: unattested,
        };

        const rawId = stableRawId({
          source: "anglish_moot",
          url: fetch.url,
          lemma_raw: word.text,
          pos_raw: pos.text,
          occurrence_index,
        });

        records.push({
          v: 1,
          source: "anglish_moot",
          rawId,
          meta: {
            ...jobMeta,
            fetchId: fetch.id,
            fetchUrl: fetch.url,
            fetchedAt: fetch.fetchedAt,
          },
          ...data,
        });
      }
    } else {
      if (cells.length === 3) {
        const [word, pos, definition] = cells;

        if (!word.text) return;

        const identityKey = `${word.text}:${pos.text}`;
        const occurrence_index = occurrenceCounters.get(identityKey) ?? 0;
        occurrenceCounters.set(identityKey, occurrence_index + 1);

        const data: ParsedA2E = {
          dictionary: "anglish_to_english",
          page_id: fetch.id,
          occurrence_index,
          lemma_raw: word.text,
          pos_raw: pos.text,
          cells_raw: {
            word: word,
            pos: pos,
            definition: definition,
          },
          definition_raw: definition,
          origin_raw: null,
        };

        const rawId = stableRawId({
          source: "anglish_moot",
          url: fetch.url,
          lemma_raw: word.text,
          pos_raw: pos.text,
          occurrence_index,
        });

        records.push({
          v: 1,
          source: "anglish_moot",
          rawId,
          meta: {
            ...jobMeta,
            fetchId: fetch.id,
            fetchUrl: fetch.url,
            fetchedAt: fetch.fetchedAt,
          },
          ...data,
        });
      }
    }
  });

  return { records };
}

function stableRawId(data: {
  source: string;
  url: string;
  lemma_raw: string;
  pos_raw: string;
  occurrence_index: number;
}): string {
  const h = crypto.createHash("sha256");
  h.update(data.source);
  h.update("\n");
  h.update(data.url);
  h.update("\n");
  h.update(data.lemma_raw);
  h.update("\n");
  h.update(data.pos_raw);
  h.update("\n");
  h.update(data.occurrence_index.toString());
  return h.digest("hex").slice(0, 20);
}
