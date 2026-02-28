import type { WordnetPOS } from "@anglish/core";
import type { Buffer } from "node:buffer";

export interface SynsetDataRedisJSON {
  synset_id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  embedding: number[];
}

export interface SynsetSearchRedisHash {
  synset_id: string;
  embedding: Buffer;
}
