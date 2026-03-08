import type { Language, WordnetPOS } from "@anglish/core";

export interface RedisSynsetData {
  synset_id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  members: string[];
  embedding: number[];
}

export interface RedisLemmaData {
  lemma: string;
  pos: WordnetPOS;
  lang: Language;
  embedding: number[];
}
