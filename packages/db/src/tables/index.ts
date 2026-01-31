import type { LemmaTable } from "./lemma";
import type { LemmaOriginTable } from "./lemma_origin";
import type { OriginTable } from "./origin";
import type { SenseTable } from "./sense";
import type { SenseSenseTable } from "./sense_sense";
import type { SynsetTable } from "./synset";
import type { SynsetSynsetTable } from "./synset_synset";

export * from "./lemma";
export * from "./lemma_origin";
export * from "./origin";
export * from "./sense";
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
  lemma_origin: LemmaOriginTable;
}
