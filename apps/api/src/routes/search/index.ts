import type { FastifyPluginAsync } from "fastify";
import { Language } from "@anglish/core";
import { wordSearch } from "@anglish/db";

const RESULTS_LENGTH = 10;

const search: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get<{
    Querystring: { q?: string; lang?: string; k?: string };
  }>("/search", async (request, reply) => {
    const { q, lang, k } = request.query;
    const input = q?.trim();

    if (!input) {
      return reply.code(400).send({ error: "Query parameter 'q' is required" });
    }
    if (lang && !Object.values(Language).includes(lang as Language)) {
      return reply.code(400).send({ error: "Invalid language" });
    }

    const limit = k ? Math.min(Math.max(1, Number.parseInt(k, 10)), 100) : RESULTS_LENGTH;

    // TODO: Sanitize input

    try {
      const results = await wordSearch(input, lang as (Language | undefined), limit);
      return results;
    }
    catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Search failed" });
    }
  });
};

export default search;
