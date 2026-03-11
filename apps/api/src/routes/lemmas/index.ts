import type { FastifyPluginAsync } from "fastify";
import { Language, WordnetPOS } from "@anglish/core";
import { db } from "@anglish/db";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

const lemmaRoutes: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get<{
    Querystring: {
      q?: string;
      lang?: string;
      pos?: string;
      limit?: string;
    };
  }>("/lemmas", async (request, reply) => {
    const { q, lang, pos, limit } = request.query;
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

    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const k = parsedLimit && Number.isFinite(parsedLimit)
      ? Math.min(Math.max(1, parsedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

    try {
      let query = db.kysely
        .selectFrom("lemma")
        .select([
          "lemma.id",
          "lemma.lemma",
          "lemma.pos",
          "lemma.lang",
        ])
        .orderBy("lemma.lemma", "asc")
        .offset(60000)
        .limit(k);

      if (search) {
        query = query.where("lemma.lemma", "like", `%${search}%`);
      }

      if (resolvedLang) {
        query = query.where("lemma.lang", "=", resolvedLang);
      }

      if (resolvedPos) {
        query = query.where("lemma.pos", "=", resolvedPos);
      }

      const rows = await query.execute();
      return rows;
    }
    catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Failed to load lemmas" });
    }
  });
};

export default lemmaRoutes;
