import { WordnetPOS } from "@anglish/core";

export const nounCategories = new Map([
  ["act", "act"],
  ["animal", "animal"],
  ["artifact", "artifact"],
  ["attribute", "attribute"],
  ["body", "body"],
  ["cognition", "cognition"],
  ["communication", "communication"],
  ["event", "event"],
  ["feeling", "feeling"],
  ["food", "food"],
  ["group", "group"],
  ["location", "location"],
  ["motive", "motive"],
  ["object", "object"],
  ["person", "person"],
  ["phenomenon", "phenomenon"],
  ["plant", "plant"],
  ["possession", "possession"],
  ["process", "process"],
  ["quantity", "quantity"],
  ["relation", "relation"],
  ["shape", "shape"],
  ["state", "state"],
  ["substance", "substance"],
  ["time", "time"],
  ["Tops", "Tops"],
]);

export const verbCategories = new Map([
  ["body", "body"],
  ["change", "change"],
  ["cognition", "cognition"],
  ["communication", "communication"],
  ["competition", "competition"],
  ["consumption", "consumption"],
  ["contact", "contact"],
  ["creation", "creation"],
  ["emotion", "emotion"],
  ["motion", "motion"],
  ["perception", "perception"],
  ["possession", "possession"],
  ["social", "social"],
  ["stative", "stative"],
  ["weather", "weather"],
]);

export const adjectiveCategories = new Map([
  ["all", "all"],
  ["pert", "pert"],
  ["ppl", "ppl"],
]);

export const adverbCategories = new Map([
  ["all", "all"],
]);

export function getCategoriesByPOS(pos: WordnetPOS): Map<string, string> {
  switch (pos) {
    case WordnetPOS.Noun:
      return nounCategories;
    case WordnetPOS.Verb:
      return verbCategories;
    case WordnetPOS.Adjective:
      return adjectiveCategories;
    case WordnetPOS.Adverb:
      return adverbCategories;
  }
  throw new Error(`Unknown POS: ${pos}`);
}
