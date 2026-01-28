import type { SynsetRelation } from "@anglish/core";
import type { Insertable, Selectable, Updateable } from "kysely";

export interface SynsetSynsetTable {
  synset_id_a: string;
  synset_id_b: string;
  relation: SynsetRelation;
}

export type SynsetSynset = Selectable<SynsetSynsetTable>;
export type NewSynsetSynset = Insertable<SynsetSynsetTable>;
export type SynsetSynsetUpdate = Updateable<SynsetSynsetTable>;
