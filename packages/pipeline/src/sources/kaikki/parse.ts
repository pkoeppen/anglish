import "colors";
import crypto from "node:crypto";
import readline from "node:readline";
import type { ParseInput } from "../../stages/02_parse";

export type KaikkiSourceRecord = {
  v: 1;
  source: "kaikki";
  rawId: string;
  data: Record<string, unknown>;
};

async function* parseJsonl(input: ParseInput): AsyncGenerator<KaikkiSourceRecord> {
  const { stream } = input;

  const rl = readline.createInterface({ input: stream!, crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    const data = JSON.parse(s) as Record<string, unknown>;

    // todo

    yield {
      v: 1,
      source: "kaikki",
      rawId: stableRawId(data),
      data,
    };
  }
}

export async function parse(input: ParseInput): Promise<{
  records: AsyncGenerator<KaikkiSourceRecord>;
}> {
  const { stream, jobMeta, fetch } = input;
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
