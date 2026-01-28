import type { OriginCode } from "@anglish/core";
import type { Insertable, Selectable, Updateable } from "kysely";

export interface OriginTable {
  code: OriginCode;
  name: string;
  description: string | null;
}

export type Origin = Selectable<OriginTable>;
export type NewOrigin = Insertable<OriginTable>;
export type OriginUpdate = Updateable<OriginTable>;
