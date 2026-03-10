import type { Language, WordnetPOS } from "@anglish/core";

export interface RedisSynsetData {
  synset_id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  members: string[];
  embedding: Float32Array;
}

export interface RedisLemmaData {
  lemma_id: number;
  sense_id: number;
  synset_id: string;
  lemma: string;
  pos: WordnetPOS;
  lang: Language;
  embedding: Float32Array;
}
