import type { FastifyPluginAsync } from "fastify";
import { Language, WordnetPOS } from "@anglish/core";
import { db } from "@anglish/db";

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 50;
const MAX_SIZE = 500;

const lemmaRoutes: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get<{
    Querystring: {
      q?: string;
      lang?: string;
      pos?: string;
      page?: string;
      size?: string;
    };
  }>("/lemmas", async (request, reply) => {
    const { q, lang, pos, page, size } = request.query;
    const search = q?.trim();

    let resolvedLang: Language | undefined;
    let resolvedPos: WordnetPOS | undefined;

    if (lang) {
      if (!Object.values(Language).includes(lang as Language)) {
        return reply.code(400).send({ error: "Invalid language" });
      }
      resolvedLang = lang as Language;
    }

    if (pos) {
      if (!Object.values(WordnetPOS).includes(pos as WordnetPOS)) {
        return reply.code(400).send({ error: "Invalid part of speech" });
      }
      resolvedPos = pos as WordnetPOS;
    }

    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedSize = size ? Number.parseInt(size, 10) : undefined;
    const resolvedPage = parsedPage && Number.isFinite(parsedPage)
      ? Math.max(1, parsedPage)
      : DEFAULT_PAGE;
    const resolvedSize = parsedSize && Number.isFinite(parsedSize)
      ? Math.min(Math.max(1, parsedSize), MAX_SIZE)
      : DEFAULT_SIZE;
    const offset = (resolvedPage - 1) * resolvedSize;

    try {
      const whereParts: string[] = [];
      const values: Array<string | number> = [];
      let paramIndex = 1;

      if (search) {
        whereParts.push(`lemma LIKE $${paramIndex++}`);
        values.push(`%${search}%`);
      }

      if (resolvedLang) {
        whereParts.push(`lang = $${paramIndex++}`);
        values.push(resolvedLang);
      }

      if (resolvedPos) {
        whereParts.push(`pos = $${paramIndex++}`);
        values.push(resolvedPos);
      }

      const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
      const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM lemma
        ${whereClause}
      `;
      const countResult = await db.pool.query<{ total: number }>(countQuery, values);
      const total = countResult.rows[0]?.total ?? 0;
      const totalPages = total > 0 ? Math.ceil(total / resolvedSize) : 0;

      const queryValues = [...values, resolvedSize, offset];
      const limitParam = values.length + 1;
      const offsetParam = values.length + 2;
      const rowsQuery = `
        SELECT
          lemma.id,
          lemma.lemma,
          lemma.pos,
          lemma.lang,
          lemma.status,
          lemma.notes,
          COALESCE(
            JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id', sense.id,
                'lemmaId', sense.lemma_id,
                'synsetId', sense.synset_id,
                'gloss', synset.gloss
              )
              ORDER BY sense.sense_index
            ) FILTER (WHERE sense.id IS NOT NULL),
            '[]'::jsonb
          ) AS senses
        FROM lemma
        LEFT JOIN sense ON lemma.id = sense.lemma_id
        LEFT JOIN synset ON sense.synset_id = synset.id
        ${whereClause}
        GROUP BY lemma.id, lemma.lemma, lemma.pos, lemma.lang, lemma.status, lemma.notes
        ORDER BY lemma.lemma ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `;

      const result = await db.pool.query(rowsQuery, queryValues);
      return {
        data: result.rows,
        page: resolvedPage,
        size: resolvedSize,
        total,
        totalPages,
      };
    }
    catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Failed to load lemmas" });
    }
  });
};

export default lemmaRoutes;
