import type { Lemma, Sense, SenseRelation, Synset } from "./thesaurus-mock-data";
import {
  MOCK_LEMMAS,
  MOCK_SENSE_RELATIONS,
  MOCK_SENSES,
  MOCK_SYNSETS,
} from "./thesaurus-mock-data";

export function getSensesForLemma(lemmaId: Lemma["id"]): Sense[] {
  return MOCK_SENSES.filter(sense => sense.lemmaId === lemmaId);
}

export function getSensesForSynset(synsetId: Synset["id"]): Sense[] {
  return MOCK_SENSES.filter(sense => sense.synsetId === synsetId);
}

export function getSenseById(id: Sense["id"]): Sense | undefined {
  return MOCK_SENSES.find(sense => sense.id === id);
}

export interface SenseRelationResolved {
  relation: SenseRelation["type"];
  fromSense: Sense;
  toSense: Sense;
  isOutgoing: boolean;
}

export function getRelationsForSense(
  senseId: Sense["id"],
): SenseRelationResolved[] {
  const rows = MOCK_SENSE_RELATIONS.filter(
    rel => rel.fromSenseId === senseId || rel.toSenseId === senseId,
  );

  return rows
    .map((rel) => {
      const fromSense = getSenseById(rel.fromSenseId);
      const toSense = getSenseById(rel.toSenseId);
      if (!fromSense || !toSense)
        return null;

      const isOutgoing = rel.fromSenseId === senseId;

      return {
        relation: rel.type,
        fromSense,
        toSense,
        isOutgoing,
      };
    })
    .filter((x): x is SenseRelationResolved => x !== null);
}

export function getLemmaForSense(sense: Sense): Lemma | undefined {
  return MOCK_LEMMAS.find(lemma => lemma.id === sense.lemmaId);
}

export function getSynsetForSense(sense: Sense): Synset | undefined {
  return MOCK_SYNSETS.find(synset => synset.id === sense.synsetId);
}
