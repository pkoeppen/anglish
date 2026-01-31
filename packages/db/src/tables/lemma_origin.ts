import type { OriginCode, OriginKind } from "@anglish/core";
import type { Insertable, Selectable, Updateable } from "kysely";

export interface LemmaOriginTable {
  lemma_id: number;
  origin_code: OriginCode;
  kind: OriginKind;
}

export type LemmaOrigin = Selectable<LemmaOriginTable>;
export type NewLemmaOrigin = Insertable<LemmaOriginTable>;
export type LemmaOriginUpdate = Updateable<LemmaOriginTable>;
