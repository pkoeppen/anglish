import type { WordnetPOS } from "@anglish/core";

export interface WordnetPOSEntry {
  sense: WordnetSense[];
  pronunciation?: { value: string; variety?: string }[];
  rhymes?: string;
  form?: string[];
}

export type WordnetEntry = {
  [pos in WordnetPOS]?: WordnetPOSEntry;
};

export type SenseRelation
  = | "agent"
    | "also"
    | "antonym"
    | "body_part"
    | "by_means_of"
    | "derivation"
    | "destination"
    | "event"
    | "exemplifies"
    | "instrument"
    | "location"
    | "material"
    | "participle"
    | "pertainym"
    | "property"
    | "result"
    | "similar"
    | "state"
    | "undergoer"
    | "uses"
    | "vehicle";

export type WordnetSense = {
  synset: string;
  id: string;
  sent?: string[];
  subcat?: string[];
  adjposition?: string;
} & {
  [key in SenseRelation]?: string[];
};

export type SynsetRelation
  = | "also"
    | "attribute"
    | "causes"
    | "domain_region"
    | "domain_topic"
    | "entails"
    | "exemplifies"
    | "hypernym"
    | "mero_member"
    | "mero_part"
    | "mero_substance"
    | "similar";

export type WordnetSynset = {
  definition: string[];
  ili: string;
  members: string[];
  partOfSpeech: string;
  example?: (string | { source: string; text: string })[];
  wikidata?: string | string[];
  source?: string;
} & {
  [key in SynsetRelation]?: string[];
};

export interface WordnetFrame {
  id: string;
  template: string;
}

export interface SynsetEmbeddingJSON {
  id: string;
  pos: WordnetPOS;
  category: string;
  headword: string;
  embedding: number[];
}
