import type { Language, WordnetPOS } from "@anglish/core";
import type { Generated, Insertable, Selectable, Updateable } from "kysely";
import type { Default } from "../shared";

export interface LemmaTable {
  id: Generated<number>;
  lemma: string;
  pos: WordnetPOS;
  lang: Default<Language>;
}

export type Lemma = Selectable<LemmaTable>;
export type NewLemma = Insertable<LemmaTable>;
export type LemmaUpdate = Updateable<LemmaTable>;
