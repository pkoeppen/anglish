import type { WordnetPOS } from "@anglish/core";

export interface RedisSynsetData {
  synset_id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  members: string[];
  embedding: number[];
}
