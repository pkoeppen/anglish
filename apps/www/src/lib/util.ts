import type { Language } from "@anglish/core";
import { WordnetPOS } from "@anglish/core";
import { getTotalPages } from "@anglish/db";
import { LETTER_ENTRIES_PER_PAGE } from "~/constants";

export function readablePos(pos: WordnetPOS) {
  switch (pos) {
    case WordnetPOS.Noun:
      return "noun";
    case WordnetPOS.Verb:
      return "verb";
    case WordnetPOS.Adjective:
    case WordnetPOS.Satellite:
      return "adj";
    case WordnetPOS.Adverb:
      return "adv";
    default:
      return "unknown";
  }
}

export async function getLetterPagePaths(lang?: Language) {
  const paths: { params: { letter: string; page: number } }[] = [];
  for (const letter of Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i))) {
    const totalPages = await getTotalPages(letter, LETTER_ENTRIES_PER_PAGE, lang);
    for (const page of Array.from({ length: totalPages }, (_, i) => i + 1)) {
      paths.push({ params: { letter, page } });
    }
  }
  return paths;
}
