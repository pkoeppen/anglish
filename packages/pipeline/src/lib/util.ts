import * as fs from "node:fs";
import * as readline from "node:readline";
import { WordnetPOS } from "@anglish/core";
import "colors";

export const wordPattern = `\\p{L}+(?:[-\\s']\\p{L}+){0,4}`;
export const wordRegex = new RegExp(`^${wordPattern}$`, "iu");

export async function* readJsonl<T>(filePath: string): AsyncGenerator<T> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const s = line.trim();
    if (!s)
      continue;
    yield JSON.parse(s) as T;
  }
}

export function wordnetReadablePOS(pos: WordnetPOS): string {
  switch (pos) {
    case WordnetPOS.Noun:
      return "noun";
    case WordnetPOS.Verb:
      return "verb";
    case WordnetPOS.Adjective:
      return "adjective";
    case WordnetPOS.Adverb:
      return "adverb";
    case WordnetPOS.Satellite:
      return "satellite";
  }
}
