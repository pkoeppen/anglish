import type { FastifyPluginAsync } from "fastify";
import { vectorSearchHNSW } from "@anglish/db";

const search: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get<{
    Querystring: { q?: string; pos?: string; k?: string };
  }>("/", async (request, reply) => {
    const { q, pos, k } = request.query;

    if (!q?.trim()) {
      return reply.code(400).send({ error: "Query parameter 'q' is required" });
    }

    /*
    This should do the following:
    - Search regular entries (lemmas) (q="book")
      - Create fuzzy Redis search index
      - Search it
    - Search by meaning (q="study of plants")
      - Search HNSW synset vectors
      - Two approaches: 1) Get the closest synset + all its members, or 2) Get matching synsets + 1 headword each
      - Return entries matching those synsets
    - Combine the results
    */

    const limit = k ? Math.min(Math.max(1, Number.parseInt(k, 10)), 100) : 20;

    try {
      const results = await vectorSearchHNSW(q.trim(), pos, limit);
      return { results };
    }
    catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Search failed" });
    }
  });
};

export default search;
