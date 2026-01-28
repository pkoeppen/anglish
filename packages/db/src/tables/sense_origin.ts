import type { OriginCode, OriginKind } from "@anglish/core";
import type { Insertable, Selectable, Updateable } from "kysely";

export interface SenseOriginTable {
  sense_id: number;
  origin_code: OriginCode;
  kind: OriginKind;
}

export type SenseOrigin = Selectable<SenseOriginTable>;
export type NewSenseOrigin = Insertable<SenseOriginTable>;
export type SenseOriginUpdate = Updateable<SenseOriginTable>;
