import type { Source, WordnetPOS } from "@anglish/core";
import type { Insertable, Selectable, Updateable } from "kysely";
import type { Default } from "../shared";

export interface SynsetTable {
  id: string;
  pos: WordnetPOS;
  gloss: string;
  category: string | null;
  ili: string | null;
  source: Default<Source>;
}

export type Synset = Selectable<SynsetTable>;
export type NewSynset = Insertable<SynsetTable>;
export type SynsetUpdate = Updateable<SynsetTable>;
