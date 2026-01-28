import type { LemmaTable } from "./lemma";
import type { OriginTable } from "./origin";
import type { SenseTable } from "./sense";
import type { SenseOriginTable } from "./sense_origin";
import type { SenseSenseTable } from "./sense_sense";
import type { SynsetTable } from "./synset";
import type { SynsetSynsetTable } from "./synset_synset";

export * from "./lemma";
export * from "./origin";
export * from "./sense";
export * from "./sense_origin";
export * from "./sense_sense";
export * from "./synset";
export * from "./synset_synset";

export interface DB {
  lemma: LemmaTable;
  synset: SynsetTable;
  sense: SenseTable;
  origin: OriginTable;
  sense_sense: SenseSenseTable;
  synset_synset: SynsetSynsetTable;
  sense_origin: SenseOriginTable;
}
