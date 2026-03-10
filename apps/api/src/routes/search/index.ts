import type { FastifyPluginAsync } from "fastify";
import { WordnetPOS } from "@anglish/core";
import { wordSearch } from "@anglish/db";

const RESULTS_LENGTH = 10;

const search: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get<{
    Querystring: { q?: string; pos?: string; k?: string };
  }>("/search", async (request, reply) => {
    const { q, pos, k } = request.query;
    const input = q?.trim();

    if (!input) {
      return reply.code(400).send({ error: "Query parameter 'q' is required" });
    }
    if (pos && !Object.values(WordnetPOS).includes(pos as WordnetPOS)) {
      return reply.code(400).send({ error: "Invalid part of speech" });
    }

    const limit = k ? Math.min(Math.max(1, Number.parseInt(k, 10)), 100) : RESULTS_LENGTH;

    try {
      const filters = { lemma: { text: input } };
      const results = await wordSearch(input, filters, limit);
      return results;
    }
    catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Search failed" });
    }
  });
};

export default search;
