import type { Language, SenseRelation, WordnetPOS } from "@anglish/core";
import { dedent } from "@anglish/core";
import { sql } from "kysely";
import { escapeLiteral } from "pg";
import { db } from "../client";

export interface WordsByLemmaResult {
  lemma: string;
  pos: WordnetPOS;
  lang: Language;
  senses: {
    sense_id: number;
    index: number;
    gloss: string;
    synonyms_en: { lemma: string; pos: WordnetPOS }[];
    synonyms_an: { lemma: string; pos: WordnetPOS }[];
    relations: {
      [key in SenseRelation]?: {
        lemma: string;
        pos: WordnetPOS;
        lang: Language;
      }[];
    };
  }[];
}

export async function getWordsByLemmaId(lemmaId: number) {
  const queryString = dedent`
    WITH seed AS (
      SELECT
        lemma.id         AS lemma_id,
        lemma.lemma      AS lemma,
        lemma.pos        AS pos,
        lemma.lang       AS lang,
        sense.id         AS sense_id,
        sense.sense_index,
        synset.id        AS synset_id,
        synset.gloss
      FROM lemma
      JOIN sense  ON sense.lemma_id = lemma.id
      JOIN synset ON synset.id = sense.synset_id
      WHERE lemma.id = ${lemmaId}
    ),
    syn_en_rows AS (
      SELECT DISTINCT
        seed.sense_id,
        l2.lemma AS lemma,
        l2.pos   AS pos
      FROM seed
      JOIN sense s2 ON s2.synset_id = seed.synset_id
      JOIN lemma l2 ON l2.id = s2.lemma_id
      WHERE l2.lang = 'en'
        AND l2.id != ${lemmaId}
    ),
    syn_en AS (
      SELECT
        sense_id,
        JSONB_AGG(JSONB_BUILD_OBJECT('lemma', lemma, 'pos', pos) ORDER BY lemma) AS synonyms_en
      FROM syn_en_rows
      GROUP BY sense_id
    ),
    syn_an_rows AS (
      SELECT DISTINCT
        seed.sense_id,
        l2.lemma AS lemma,
        l2.pos   AS pos
      FROM seed
      JOIN sense s2 ON s2.synset_id = seed.synset_id
      JOIN lemma l2 ON l2.id = s2.lemma_id
      WHERE l2.lang = 'an'
        AND l2.id != ${lemmaId}
    ),
    syn_an AS (
      SELECT
        sense_id,
        JSONB_AGG(JSONB_BUILD_OBJECT('lemma', lemma, 'pos', pos) ORDER BY lemma) AS synonyms_an
      FROM syn_an_rows
      GROUP BY sense_id
    ),
    sense_rel_rows AS (
      SELECT DISTINCT
        seed.sense_id AS seed_sense_id,
        l2.lemma,
        l2.pos,
        l2.lang,
        ss.relation
      FROM seed
      JOIN sense_sense ss ON ss.sense_id_a = seed.sense_id
      JOIN sense s2 ON s2.id = ss.sense_id_b
      JOIN lemma l2 ON l2.id = s2.lemma_id
      WHERE l2.id != ${lemmaId}
    ),
    sense_rel_arrays AS (
      SELECT
        seed_sense_id,
        relation,
        JSONB_AGG(
          JSONB_BUILD_OBJECT('lemma', lemma, 'pos', pos, 'lang', lang)
          ORDER BY lemma
        ) AS items
      FROM sense_rel_rows
      GROUP BY seed_sense_id, relation
    ),
    sense_rel AS (
      SELECT
        seed_sense_id,
        JSONB_OBJECT_AGG(relation, items) AS relations
      FROM sense_rel_arrays
      GROUP BY seed_sense_id
    ),
    senses AS (
      SELECT
        seed.lemma_id,
        seed.lemma,
        seed.pos,
        seed.lang,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'sense_id', seed.sense_id,
            'index',    seed.sense_index,
            'gloss',    seed.gloss,
            'synonyms_en', COALESCE(syn_en.synonyms_en, '[]'::JSONB),
            'synonyms_an', COALESCE(syn_an.synonyms_an, '[]'::JSONB),
            'relations', COALESCE(sense_rel.relations, '{}'::JSONB)
          )
          ORDER BY seed.sense_index
        ) AS senses
      FROM seed
      LEFT JOIN syn_en ON syn_en.sense_id = seed.sense_id
      LEFT JOIN syn_an ON syn_an.sense_id = seed.sense_id
      LEFT JOIN sense_rel ON sense_rel.seed_sense_id = seed.sense_id
      GROUP BY seed.lemma_id, seed.lemma, seed.pos, seed.lang
    )
    SELECT
      lemma,
      pos,
      lang,
      senses
    FROM senses;
  `;

  const result = await sql.raw<WordsByLemmaResult>(queryString).execute(db.kysely);

  return result.rows;
}
