import type { SenseRelation } from "@anglish/core";
import type { Insertable, Selectable, Updateable } from "kysely";

export interface SenseSenseTable {
  sense_id_a: number;
  sense_id_b: number;
  relation: SenseRelation;
}

export type SenseSense = Selectable<SenseSenseTable>;
export type NewSenseSense = Insertable<SenseSenseTable>;
export type SenseSenseUpdate = Updateable<SenseSenseTable>;
