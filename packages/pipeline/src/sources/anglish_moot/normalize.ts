import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NormalizedRecord } from "../../stages/03_normalize";
import { type AnglishMootSourceRecord } from "./parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wordPattern = `\\p{L}+([-\\s']\\p{L}+){0,4}`;
const wordRegex = new RegExp(`^${wordPattern}$`, "iu");

// Load abbreviations for the origins pattern
const abbreviations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "abbreviations.json"), "utf8"),
);
const originsPattern = `(${Object.keys(abbreviations)
  .map((s) => s.replace(".", ""))
  .join("|")})`;
const originRegExp = new RegExp(`^${originsPattern}$`, "i");

export function normalize(
  record: AnglishMootSourceRecord,
  normalizedAt: string,
): NormalizedRecord | null {
  return null;
}

function cleanWordString(word: string): string | null {
  word = word
    .replace(/\([^)]*\)/g, "") // Remove (parentheses)
    .replace(/\[[^\]]*\]/g, "") // Remove [square brackets]
    .replace(/\n.*$/g, "") // Remove anything that comes after a newline
    .replace(/\s+/g, " ") // Remove extra spaces between words
    .trim();

  if (!wordRegex.test(word)) {
    const match = word.match(new RegExp(`^${wordPattern}(?=\\s*[\\/,])`, "iu"));
    if (!match) return null;
    word = match[0];
  }

  return word;
}
