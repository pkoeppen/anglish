import "colors";
import crypto from "node:crypto";
import type { ParseInput } from "../../stages/02_parse";

export type HurlebatteSourceRecord = {
  v: 1;
  source: "hurlebatte";
  rawId: string;
  lemma_raw: string;
  pos_raw: string;
  occurrence_index: number;
  definition_raw: string;
  etymology_raw: string;
  origin_raw: string;
  notes_raw: string;
  tags_raw: string;
  meta?: Record<string, unknown>;
};

export async function parse(input: ParseInput): Promise<{
  records: HurlebatteSourceRecord[];
}> {
  if (input.content === undefined) {
    throw new Error("Hurlebatte parser requires full content, but received a stream.");
  }
  const rows = parseCSV(input.content);
  if (rows.length === 0) return { records: [] };

  const header = rows[0].map((s) => s.trim().toUpperCase());
  const dataRows = rows.slice(1);

  // WORD,SPELLING,DEFINITION,WORD CLASS,ETYMOLOGY,LANG ORIGIN ‹×,NOTES,TAGS
  const idx = {
    entry: header.indexOf("WORD"),
    spelling: header.indexOf("SPELLING"),
    definition: header.indexOf("DEFINITION"),
    wordClass: header.indexOf("WORD CLASS"),
    etymology: header.indexOf("ETYMOLOGY"),
    langOrigin: header.indexOf("LANG. ORIGIN  ‹×"),
    notes: header.indexOf("NOTES"),
    tags: header.indexOf("TAGS"),
  };

  const get = (r: string[], i: number) => (i >= 0 && i < r.length ? (r[i] ?? "") : "");

  const records: HurlebatteSourceRecord[] = [];
  const occurrenceCounters = new Map<string, number>();

  for (const r of dataRows) {
    const lemma_raw = get(r, idx.entry);
    if (!lemma_raw) continue;

    const pos_raw = get(r, idx.wordClass);
    const origin_raw = get(r, idx.langOrigin);
    const definition_raw = get(r, idx.definition);
    const etymology_raw = get(r, idx.etymology);
    const notes_raw = get(r, idx.notes);
    const tags_raw = get(r, idx.tags);

    const identityKey = `${lemma_raw}:${pos_raw}:${origin_raw}`;
    const occurrence_index = occurrenceCounters.get(identityKey) ?? 0;
    occurrenceCounters.set(identityKey, occurrence_index + 1);

    records.push({
      v: 1,
      source: "hurlebatte",
      rawId: stableRawId({
        source: "hurlebatte",
        lemma_raw,
        pos_raw,
        occurrence_index,
      }),
      lemma_raw,
      pos_raw,
      occurrence_index,
      definition_raw,
      etymology_raw,
      origin_raw,
      notes_raw,
      tags_raw,
    });
  }

  return { records };
}

function stableRawId(data: {
  source: string;
  lemma_raw: string;
  pos_raw: string;
  occurrence_index: number;
}): string {
  const h = crypto.createHash("sha256");
  h.update(data.source);
  h.update("\n");
  h.update(data.lemma_raw);
  h.update("\n");
  h.update(data.pos_raw);
  h.update("\n");
  h.update(data.occurrence_index.toString());
  return h.digest("hex").slice(0, 20);
}

function parseCSV(csv: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const s = csv ?? "";
  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i += 2;
      else i += 1;

      row.push(field);
      field = "";

      const isBlank = row.every((x) => (x ?? "").trim() === "");
      if (!isBlank) out.push(row);

      row = [];
      continue;
    }

    field += ch;
    i += 1;
  }

  row.push(field);
  const isBlank = row.every((x) => (x ?? "").trim() === "");
  if (!isBlank) out.push(row);

  return out;
}
