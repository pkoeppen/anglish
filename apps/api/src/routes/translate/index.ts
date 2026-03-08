import type { WordnetPOS } from "@anglish/core";
import type { FastifyPluginAsync } from "fastify";
import { translateText } from "./translate";

const translate: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get<{
    Querystring: { q?: string; exclude?: string };
  }>("/translate", async (req, res) => {
    const { q, exclude } = req.query;

    if (!q?.trim()) {
      return res.code(400).send({ error: "Query parameter 'q' is required" });
    }
    const excludePOS = new Set(exclude?.split(",") ?? []) as Set<WordnetPOS>;

    const terms = await translateText(q, excludePOS);

    return terms;
  });
};

export default translate;
