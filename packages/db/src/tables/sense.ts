import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface SenseTable {
  id: Generated<number>;
  lemma_id: number;
  synset_id: string;
  sense_index: Generated<number>;
  examples: Generated<string[]>;
}

export type Sense = Selectable<SenseTable>;
export type NewSense = Insertable<SenseTable>;
export type SenseUpdate = Updateable<SenseTable>;
