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
  = | "exemplifies"
    | "pertainym"
    | "derivation"
    | "event"
    | "antonym"
    | "state"
    | "agent"
    | "result"
    | "body_part"
    | "undergoer"
    | "also"
    | "property"
    | "location"
    | "by_means_of"
    | "instrument"
    | "uses"
    | "material"
    | "vehicle"
    | "participle"
    | "destination"
    | "similar";

export type WordnetSense = {
  synset: string;
  id: string;
  sent?: string[];
  subcat?: string[];
  adjposition?: string;
} & {
  [key in SenseRelation]?: string[];
};

export type SynsetRelation = "exemplifies" | "similar" | "hypernym" | "attribute";

export type WordnetSynset = {
  definition: string[];
  ili: string;
  members: string[];
  partOfSpeech: string;
  example?: (string | { source: string; text: string })[];
} & {
  [key in SynsetRelation]?: string[];
};

export interface WordnetFrame {
  id: string;
  template: string;
}
