import type { Language, WordnetPOS } from "@anglish/core";

export interface RedisSynsetData {
  synset_id: string;
  pos: WordnetPOS;
  members: { lemma: string; lang: Language }[];
  embedding: Float32Array;
}
