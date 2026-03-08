import type { Language, WordnetPOS } from "@anglish/core";

export interface RedisSynsetData {
  synset_id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  members: (string | { lemma: string; lang: Language })[];
  embedding: number[];
}
