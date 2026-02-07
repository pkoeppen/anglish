import { WordnetPOS } from "@anglish/core";

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

export function slugify(text: string) {
  return text.toLowerCase().replace(/ /g, "_");
}

export function unslugify(text: string) {
  return text.replace(/_/g, " ");
}
